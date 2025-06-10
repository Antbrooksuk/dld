import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"
// Import Vite dynamically to avoid import-time issues
import type { ViteDevServer } from "vite"
import { ComponentTemplateGenerator } from "./ComponentTemplateGenerator"
import { ComponentInfo } from "../../shared/preview-types"

/**
 * Manages the Vite dev server for component previews
 */
export class PreviewServerManager {
	private static instance: PreviewServerManager | undefined
	private viteServer: ViteDevServer | undefined
	private readonly port = 5174
	private readonly host = "localhost"
	private isStarting = false
	private currentComponent: ComponentInfo | undefined
	private themeWatcher: fs.FSWatcher | undefined

	private constructor(
		private readonly extensionPath: string,
		private readonly workspacePath: string,
		private readonly outputChannel?: any,
	) {
		// Validate paths in constructor
		if (!extensionPath || typeof extensionPath !== "string") {
			throw new Error(`Invalid extensionPath: ${extensionPath}`)
		}
		if (!workspacePath || typeof workspacePath !== "string") {
			throw new Error(`Invalid workspacePath: ${workspacePath}`)
		}
	}

	public static getInstance(extensionPath: string, workspacePath: string): PreviewServerManager {
		if (!PreviewServerManager.instance) {
			// Validate paths before creating instance
			if (!extensionPath || !workspacePath) {
				throw new Error("PreviewServerManager requires valid extensionPath and workspacePath")
			}
			PreviewServerManager.instance = new PreviewServerManager(extensionPath, workspacePath)
		}
		return PreviewServerManager.instance
	}

	/**
	 * Start the Vite dev server
	 */
	public async start(): Promise<void> {
		if (this.viteServer || this.isStarting) {
			console.log("Preview server already running or starting")
			return
		}

		this.isStarting = true

		try {
			console.log("Starting Vite preview server...")
			console.log("Extension path:", this.extensionPath)
			console.log("Workspace path:", this.workspacePath)

			const previewRoot = path.resolve(this.extensionPath, "preview")
			console.log("Preview root:", previewRoot)

			// Check if preview directory exists
			try {
				const stat = fs.statSync(previewRoot)
				console.log("Preview directory exists:", stat.isDirectory())
				const files = fs.readdirSync(previewRoot)
				console.log("Preview directory contents:", files)
			} catch (error) {
				console.error("Preview directory check failed:", error)
				throw new Error(`Preview directory does not exist at: ${previewRoot}`)
			}

			// Dynamically import Vite to avoid import-time issues
			const { createServer } = await import("vite")
			const react = (await import("@vitejs/plugin-react")).default

			// Create Vite server configuration
			console.log("About to call createServer with previewRoot:", previewRoot)

			this.viteServer = await createServer({
				root: previewRoot,
				plugins: [react()],
				server: {
					port: this.port,
					host: this.host,
					strictPort: true,
					open: false,
				},
				css: {
					postcss: {
						plugins: [(await import("@tailwindcss/postcss")).default()],
					},
				},
			})

			console.log("createServer succeeded, viteServer created")

			// Start the server
			await this.viteServer.listen(this.port)

			console.log(`✅ Vite preview server started on http://${this.host}:${this.port}`)

			// Start watching theme files for changes
			this.startThemeWatcher()
		} catch (error) {
			console.error("Error starting Vite preview server:", error)
			console.error("Extension path was:", this.extensionPath)
			console.error("Workspace path was:", this.workspacePath)
			this.viteServer = undefined
			throw new Error(
				`Failed to start Vite server: ${error.message}. Extension path: ${this.extensionPath}, Workspace path: ${this.workspacePath}`,
			)
		} finally {
			this.isStarting = false
		}
	}

	/**
	 * Stop the Vite dev server
	 */
	public async stop(): Promise<void> {
		if (!this.viteServer) {
			console.log("Preview server not running")
			return
		}

		try {
			console.log("Stopping Vite preview server...")

			// Stop theme watcher
			this.stopThemeWatcher()

			await this.viteServer.close()
			this.viteServer = undefined

			console.log("✅ Vite preview server stopped")
		} catch (error) {
			console.error("Error stopping Vite preview server:", error)
			throw error
		}
	}

	/**
	 * Get the server URL
	 */
	public getServerUrl(): string {
		return `http://${this.host}:${this.port}`
	}

	/**
	 * Check if server is running
	 */
	public isRunning(): boolean {
		return this.viteServer !== undefined
	}

	/**
	 * Scan workspace theme folder and update CSS dynamically
	 */
	private async updateTailwindCssWithThemes(): Promise<void> {
		try {
			console.log("Scanning workspace for theme files...")

			const foundThemes: string[] = []
			const themeFolderPath = path.join(this.workspacePath, "src", "theme")

			if (fs.existsSync(themeFolderPath)) {
				console.log(`Found theme folder: ${themeFolderPath}`)

				const files = fs.readdirSync(themeFolderPath)
				const cssFiles = files.filter((file) => file.endsWith(".css"))

				for (const file of cssFiles) {
					const previewRoot = path.resolve(this.extensionPath, "preview")
					const themeFilePath = path.join(themeFolderPath, file)
					const relativePath = path.relative(previewRoot, themeFilePath)
					foundThemes.push(relativePath)
					console.log(`Found theme file: ${relativePath}`)
				}
			} else {
				console.log("No theme folder found at src/theme")
			}

			// Generate the CSS content with dynamic imports
			const cssContent = await this.generateDynamicTailwindCss(foundThemes)

			// Write the updated CSS file
			const cssPath = path.resolve(this.extensionPath, "preview", "tailwind.css")
			fs.writeFileSync(cssPath, cssContent)

			console.log(`✅ Updated tailwind.css with ${foundThemes.length} theme imports`)
			console.log("Generated CSS preview:", cssContent.substring(0, 500) + "...")
		} catch (error) {
			console.error("Error updating Tailwind CSS with themes:", error)
			// Continue with default CSS if theme detection fails
		}
	}

	/**
	 * Parse CSS content to extract custom theme properties
	 */
	private parseCustomThemeProperties(cssContent: string): {
		colors: Set<string>
		spacing: Set<string>
		textSizes: Set<string>
		fonts: Set<string>
		utilityDefinitions: string[]
	} {
		const colors = new Set<string>()
		const spacing = new Set<string>()
		const textSizes = new Set<string>()
		const fonts = new Set<string>()
		const utilityDefinitions: string[] = []

		// Parse CSS variables like --color-primary-500, --spacing-3xl, etc.
		const cssVarRegex = /--([a-zA-Z][a-zA-Z0-9-]*)-([a-zA-Z0-9-]+):/g
		let match
		while ((match = cssVarRegex.exec(cssContent)) !== null) {
			const category = match[1]
			const name = match[2]

			if (category === "color") {
				colors.add(name)
			} else if (category === "spacing" || category === "size") {
				spacing.add(name)
			} else if (category === "text" || category === "font-size") {
				textSizes.add(name)
			} else if (category === "font" || category === "font-family") {
				fonts.add(name)
			} else if (/^\d{2,3}$|^(50|950)$/.test(name)) {
				// This looks like a color scale (e.g., --primary-500)
				colors.add(category)
			}
		}

		// Parse @theme blocks looking for various property definitions
		const themeBlockRegex = /@theme\s+inline\s*\{([^}]+)\}/g
		let themeMatch
		while ((themeMatch = themeBlockRegex.exec(cssContent)) !== null) {
			const themeContent = themeMatch[1]

			// Colors: --color-primary-500
			const colorRegex = /--color-([a-zA-Z][a-zA-Z0-9-]*)-(?:\d{2,3}|50|950):/g
			let colorMatch
			while ((colorMatch = colorRegex.exec(themeContent)) !== null) {
				colors.add(colorMatch[1])
			}

			// Spacing: --spacing-3xl, --size-massive
			const spacingRegex = /--(?:spacing|size)-([a-zA-Z0-9]+):/g
			let spacingMatch
			while ((spacingMatch = spacingRegex.exec(themeContent)) !== null) {
				spacing.add(spacingMatch[1])
			}

			// Text sizes: --text-10xl, --font-size-massive
			const textRegex = /--(?:text|font-size)-([a-zA-Z0-9]+):/g
			let textMatch
			while ((textMatch = textRegex.exec(themeContent)) !== null) {
				textSizes.add(textMatch[1])
			}

			// Fonts: --font-brand, --font-family-display
			const fontRegex = /--(?:font|font-family)-([a-zA-Z0-9-]+):/g
			let fontMatch
			while ((fontMatch = fontRegex.exec(themeContent)) !== null) {
				fonts.add(fontMatch[1])
			}
		}

		// Parse @utility blocks to extract complete utility definitions
		const utilityRegex = /@utility\s+([a-zA-Z][a-zA-Z0-9-]*)\s*\{([^}]+)\}/g
		let utilityMatch
		while ((utilityMatch = utilityRegex.exec(cssContent)) !== null) {
			const utilityName = utilityMatch[1]
			const utilityBody = utilityMatch[2]
			const fullDefinition = `@utility ${utilityName} {${utilityBody}}`
			utilityDefinitions.push(fullDefinition)
		}

		console.log("Extracted custom properties:", {
			colors: Array.from(colors),
			spacing: Array.from(spacing),
			textSizes: Array.from(textSizes),
			fonts: Array.from(fonts),
			utilityDefinitions: utilityDefinitions,
		})

		return { colors, spacing, textSizes, fonts, utilityDefinitions }
	}

	/**
	 * Generate comprehensive Tailwind CSS safelist with all foundations and custom properties
	 */
	private async generateDynamicTailwindCss(themeImports: string[]): Promise<string> {
		// Parse all theme files to extract custom properties
		const allCustomColors = new Set<string>()
		const allCustomSpacing = new Set<string>()
		const allCustomTextSizes = new Set<string>()
		const allCustomFonts = new Set<string>()
		const allUtilityDefinitions: string[] = []

		for (const themeImport of themeImports) {
			try {
				const previewRoot = path.resolve(this.extensionPath, "preview")
				const filePath = path.resolve(previewRoot, themeImport)
				console.log(`Looking for theme file at: ${filePath}`)

				if (fs.existsSync(filePath)) {
					console.log(`Reading theme file: ${filePath}`)
					const cssContent = fs.readFileSync(filePath, "utf8")
					const { colors, spacing, textSizes, fonts, utilityDefinitions } = this.parseCustomThemeProperties(cssContent)

					colors.forEach((color) => allCustomColors.add(color))
					spacing.forEach((size) => allCustomSpacing.add(size))
					textSizes.forEach((size) => allCustomTextSizes.add(size))
					fonts.forEach((font) => allCustomFonts.add(font))
					allUtilityDefinitions.push(...utilityDefinitions)
				}
			} catch (error) {
				console.log(`Could not parse theme file ${themeImport}:`, error.message)
			}
		}

		// Build comprehensive foundation arrays
		const standardColors = [
			"red",
			"orange",
			"amber",
			"yellow",
			"lime",
			"green",
			"emerald",
			"teal",
			"cyan",
			"sky",
			"blue",
			"indigo",
			"violet",
			"purple",
			"fuchsia",
			"pink",
			"rose",
			"slate",
			"gray",
			"zinc",
			"neutral",
			"stone",
			"black",
			"white",
		]

		// Filter custom colors to only include valid color names (not semantic tokens)
		const validCustomColors = Array.from(allCustomColors).filter((color) => {
			// Exclude semantic tokens and system colors
			const semanticTokens = [
				"background",
				"foreground",
				"card",
				"popover",
				"primary",
				"secondary",
				"muted",
				"accent",
				"destructive",
				"border",
				"input",
				"ring",
				"sidebar",
			]
			const invalidPatterns = ["color-", "font-", "size-", "family-"]

			return (
				!semanticTokens.includes(color) &&
				!invalidPatterns.some((pattern) => color.startsWith(pattern)) &&
				color.length > 0 &&
				/^[a-zA-Z][a-zA-Z0-9-]*$/.test(color)
			)
		})

		// Create unique color list
		const allColors = [...new Set([...standardColors, ...validCustomColors])]

		const standardSpacing = [
			"0",
			"px",
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
			"8",
			"9",
			"10",
			"11",
			"12",
			"14",
			"16",
			"20",
			"24",
			"28",
			"32",
			"36",
			"40",
			"44",
			"48",
			"52",
			"56",
			"60",
			"64",
			"72",
			"80",
			"96",
			"auto",
		]
		const allSpacing = [...standardSpacing, ...Array.from(allCustomSpacing)]

		const standardTextSizes = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"]
		const allTextSizes = [...standardTextSizes, ...Array.from(allCustomTextSizes)]

		const standardFonts = ["sans", "serif", "mono"]
		const allFonts = [...standardFonts, ...Array.from(allCustomFonts)]

		// Standard Tailwind container sizes
		const containerSizes = ["3xs", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl"]

		// Standard breakpoints
		const breakpoints = ["sm", "md", "lg", "xl", "2xl"]

		// Extract custom utility names
		const utilityNamesSet = new Set(
			allUtilityDefinitions
				.map((def) => {
					const match = def.match(/@utility\s+([a-zA-Z][a-zA-Z0-9-]*)/)
					return match ? match[1] : null
				})
				.filter(Boolean),
		)
		const utilityNames = Array.from(utilityNamesSet)

		const imports = themeImports.map((theme) => `@import "${theme}";`).join("\n")

		return `@import "tailwindcss";
${imports}

/* === COMPREHENSIVE TAILWIND FOUNDATIONS SAFELIST === */

/* Colors - All variants with all shades */
@source inline('bg-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('text-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('border-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('ring-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('shadow-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('from-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('via-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('to-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('accent-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('caret-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('fill-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('stroke-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('outline-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');

/* Color variants with hover, focus, active states */
@source inline('hover:bg-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('hover:text-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('hover:border-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('focus:bg-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('focus:text-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('focus:border-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('focus:ring-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('active:bg-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');

/* Spacing - All directions and variants */
@source inline('p-{${allSpacing.join(",")}}');
@source inline('px-{${allSpacing.join(",")}}');
@source inline('py-{${allSpacing.join(",")}}');
@source inline('pt-{${allSpacing.join(",")}}');
@source inline('pr-{${allSpacing.join(",")}}');
@source inline('pb-{${allSpacing.join(",")}}');
@source inline('pl-{${allSpacing.join(",")}}');
@source inline('m-{${allSpacing.join(",")}}');
@source inline('mx-{${allSpacing.join(",")}}');
@source inline('my-{${allSpacing.join(",")}}');
@source inline('mt-{${allSpacing.join(",")}}');
@source inline('mr-{${allSpacing.join(",")}}');
@source inline('mb-{${allSpacing.join(",")}}');
@source inline('ml-{${allSpacing.join(",")}}');
@source inline('-m-{${allSpacing.join(",")}}');
@source inline('-mx-{${allSpacing.join(",")}}');
@source inline('-my-{${allSpacing.join(",")}}');
@source inline('-mt-{${allSpacing.join(",")}}');
@source inline('-mr-{${allSpacing.join(",")}}');
@source inline('-mb-{${allSpacing.join(",")}}');
@source inline('-ml-{${allSpacing.join(",")}}');

/* Width and Height */
@source inline('w-{${allSpacing.join(",")}}');
@source inline('h-{${allSpacing.join(",")}}');
@source inline('min-w-{${allSpacing.join(",")}}');
@source inline('min-h-{${allSpacing.join(",")}}');
@source inline('max-w-{${allSpacing.join(",")}}');
@source inline('max-h-{${allSpacing.join(",")}}');
@source inline('w-{full,screen,fit,min,max}');
@source inline('h-{full,screen,fit,min,max}');
@source inline('min-w-{full,screen,fit,min,max}');
@source inline('min-h-{full,screen,fit,min,max}');
@source inline('max-w-{${containerSizes.join(",")},full,screen,fit,min,max,none}');
@source inline('max-h-{full,screen,fit,min,max}');

/* Positioning */
@source inline('top-{${allSpacing.join(",")}}');
@source inline('right-{${allSpacing.join(",")}}');
@source inline('bottom-{${allSpacing.join(",")}}');
@source inline('left-{${allSpacing.join(",")}}');
@source inline('inset-{${allSpacing.join(",")}}');
@source inline('inset-x-{${allSpacing.join(",")}}');
@source inline('inset-y-{${allSpacing.join(",")}}');
@source inline('-top-{${allSpacing.join(",")}}');
@source inline('-right-{${allSpacing.join(",")}}');
@source inline('-bottom-{${allSpacing.join(",")}}');
@source inline('-left-{${allSpacing.join(",")}}');

/* Typography */
@source inline('text-{${allTextSizes.join(",")}}');
@source inline('font-{${allFonts.join(",")}}');
@source inline('font-{thin,extralight,light,normal,medium,semibold,bold,extrabold,black}');
@source inline('leading-{3,4,5,6,7,8,9,10,none,tight,snug,normal,relaxed,loose}');
@source inline('tracking-{tighter,tight,normal,wide,wider,widest}');
@source inline('text-{left,center,right,justify,start,end}');
@source inline('text-{inherit,current,transparent}');

/* Border radius */
@source inline('rounded{,-none,-sm,-md,-lg,-xl,-2xl,-3xl,-full}');
@source inline('rounded-t{,-none,-sm,-md,-lg,-xl,-2xl,-3xl,-full}');
@source inline('rounded-r{,-none,-sm,-md,-lg,-xl,-2xl,-3xl,-full}');
@source inline('rounded-b{,-none,-sm,-md,-lg,-xl,-2xl,-3xl,-full}');
@source inline('rounded-l{,-none,-sm,-md,-lg,-xl,-2xl,-3xl,-full}');
@source inline('rounded-tl{,-none,-sm,-md,-lg,-xl,-2xl,-3xl,-full}');
@source inline('rounded-tr{,-none,-sm,-md,-lg,-xl,-2xl,-3xl,-full}');
@source inline('rounded-br{,-none,-sm,-md,-lg,-xl,-2xl,-3xl,-full}');
@source inline('rounded-bl{,-none,-sm,-md,-lg,-xl,-2xl,-3xl,-full}');

/* Border width */
@source inline('border{,-0,-2,-4,-8}');
@source inline('border-t{,-0,-2,-4,-8}');
@source inline('border-r{,-0,-2,-4,-8}');
@source inline('border-b{,-0,-2,-4,-8}');
@source inline('border-l{,-0,-2,-4,-8}');
@source inline('border-x{,-0,-2,-4,-8}');
@source inline('border-y{,-0,-2,-4,-8}');

/* Layout and Display */
@source inline('{block,inline-block,inline,flex,inline-flex,table,inline-table,table-caption,table-cell,table-column,table-column-group,table-footer-group,table-header-group,table-row-group,table-row,flow-root,grid,inline-grid,contents,list-item,hidden}');
@source inline('{static,fixed,absolute,relative,sticky}');
@source inline('{visible,invisible,collapse}');
@source inline('overflow-{auto,hidden,clip,visible,scroll}');
@source inline('overflow-x-{auto,hidden,clip,visible,scroll}');
@source inline('overflow-y-{auto,hidden,clip,visible,scroll}');

/* Flexbox */
@source inline('flex-{1,auto,initial,none}');
@source inline('flex-{row,row-reverse,col,col-reverse}');
@source inline('flex-{wrap,wrap-reverse,nowrap}');
@source inline('grow{,-0}');
@source inline('shrink{,-0}');
@source inline('justify-{normal,start,end,center,between,around,evenly,stretch}');
@source inline('justify-items-{start,end,center,stretch}');
@source inline('justify-self-{auto,start,end,center,stretch}');
@source inline('content-{normal,center,start,end,between,around,evenly,baseline,stretch}');
@source inline('items-{start,end,center,baseline,stretch}');
@source inline('self-{auto,start,end,center,stretch,baseline}');

/* Grid */
@source inline('grid-cols-{1,2,3,4,5,6,7,8,9,10,11,12,none,subgrid}');
@source inline('grid-rows-{1,2,3,4,5,6,7,8,9,10,11,12,none,subgrid}');
@source inline('col-{auto,span-1,span-2,span-3,span-4,span-5,span-6,span-7,span-8,span-9,span-10,span-11,span-12,span-full}');
@source inline('row-{auto,span-1,span-2,span-3,span-4,span-5,span-6,span-7,span-8,span-9,span-10,span-11,span-12,span-full}');
@source inline('col-start-{1,2,3,4,5,6,7,8,9,10,11,12,13,auto}');
@source inline('col-end-{1,2,3,4,5,6,7,8,9,10,11,12,13,auto}');
@source inline('row-start-{1,2,3,4,5,6,7,8,9,10,11,12,13,auto}');
@source inline('row-end-{1,2,3,4,5,6,7,8,9,10,11,12,13,auto}');
@source inline('gap-{${allSpacing.join(",")}}');
@source inline('gap-x-{${allSpacing.join(",")}}');
@source inline('gap-y-{${allSpacing.join(",")}}');

/* Shadows and Effects */
@source inline('shadow{,-xs,-sm,-md,-lg,-xl,-2xl,-inner,-none}');
@source inline('drop-shadow{,-xs,-sm,-md,-lg,-xl,-2xl,-none}');
@source inline('blur{,-none,-sm,-md,-lg,-xl,-2xl,-3xl}');
@source inline('brightness-{0,50,75,90,95,100,105,110,125,150,200}');
@source inline('contrast-{0,50,75,100,125,150,200}');
@source inline('grayscale{,-0}');
@source inline('hue-rotate-{0,15,30,60,90,180}');
@source inline('invert{,-0}');
@source inline('saturate-{0,50,100,150,200}');
@source inline('sepia{,-0}');

/* Opacity */
@source inline('opacity-{0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100}');
@source inline('bg-opacity-{0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100}');
@source inline('text-opacity-{0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100}');
@source inline('border-opacity-{0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100}');

/* Z-index */
@source inline('z-{0,10,20,30,40,50,auto}');
@source inline('-z-{0,10,20,30,40,50}');

/* Responsive breakpoints for all utilities */
${breakpoints
	.map(
		(bp) => `
@source inline('${bp}:grid-cols-{1,2,3,4,5,6,7,8,9,10,11,12}');
@source inline('${bp}:gap-{${allSpacing.join(",")}}');
@source inline('${bp}:p-{${allSpacing.join(",")}}');
@source inline('${bp}:m-{${allSpacing.join(",")}}');
@source inline('${bp}:text-{${allTextSizes.join(",")}}');
@source inline('${bp}:w-{${allSpacing.join(",")}}');
@source inline('${bp}:h-{${allSpacing.join(",")}}');
@source inline('${bp}:{block,inline-block,inline,flex,inline-flex,grid,inline-grid,hidden}');
@source inline('${bp}:flex-{row,row-reverse,col,col-reverse}');`,
	)
	.join("")}

/* Custom utilities from theme files */
${utilityNames.length > 0 ? `@source inline('{${utilityNames.join(",")}}');` : ""}

/* Dark mode variants for key utilities */
@source inline('dark:bg-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('dark:text-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('dark:border-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');

/* State variants for interactivity */
@source inline('group-hover:bg-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('peer-focus:bg-{${allColors.join(",")}}-{50,100,200,300,400,500,600,700,800,900,950}');
@source inline('disabled:opacity-{50,75}');
@source inline('disabled:bg-{gray,slate,zinc,neutral,stone}-{100,200,300}');
`
	}

	/**
	 * Update the component being previewed
	 * This will regenerate the entry point and trigger a reload
	 */
	public async updateComponent(componentInfo: ComponentInfo): Promise<void> {
		try {
			console.log(`Updating preview component: ${componentInfo.name}`)

			// Store the current component
			this.currentComponent = componentInfo

			// Update CSS with any themes before generating component
			await this.updateTailwindCssWithThemes()

			// Generate the new entry point
			const template = ComponentTemplateGenerator.generateTemplate(
				componentInfo.path,
				componentInfo.name,
				componentInfo.props,
				this.extensionPath,
			)

			// Write the entry point file
			const entryPointPath = path.resolve(this.extensionPath, "preview", "index.jsx")
			fs.writeFileSync(entryPointPath, template)

			console.log("✅ Component entry point updated")

			// Vite will automatically detect the change and reload via HMR
		} catch (error) {
			console.error("Error updating component:", error)
			throw error
		}
	}

	/**
	 * Update component props without changing the component
	 */
	public async updateComponentProps(props: ComponentInfo["props"]): Promise<void> {
		if (!this.currentComponent) {
			throw new Error("No component currently loaded")
		}

		await this.updateComponent({
			...this.currentComponent,
			props,
		})
	}

	/**
	 * Get the currently previewed component
	 */
	public getCurrentComponent(): ComponentInfo | undefined {
		return this.currentComponent
	}

	/**
	 * Start watching theme files for changes
	 */
	private startThemeWatcher(): void {
		try {
			const themeFolderPath = path.join(this.workspacePath, "src", "theme")

			if (!fs.existsSync(themeFolderPath)) {
				console.log("No theme folder found, skipping theme watcher")
				return
			}

			console.log("Starting theme file watcher...")

			this.themeWatcher = fs.watch(themeFolderPath, { recursive: true }, (_eventType, filename) => {
				if (filename && filename.endsWith(".css")) {
					console.log(`Theme file changed: ${filename}`)
					this.onThemeFileChanged()
				}
			})

			console.log("✅ Theme file watcher started")
		} catch (error) {
			console.error("Error starting theme watcher:", error)
		}
	}

	/**
	 * Stop watching theme files
	 */
	private stopThemeWatcher(): void {
		if (this.themeWatcher) {
			this.themeWatcher.close()
			this.themeWatcher = undefined
			console.log("✅ Theme file watcher stopped")
		}
	}

	/**
	 * Handle theme file changes by regenerating CSS
	 */
	private async onThemeFileChanged(): Promise<void> {
		try {
			console.log("Regenerating CSS due to theme file change...")
			await this.updateTailwindCssWithThemes()
			console.log("✅ CSS regenerated successfully")
		} catch (error) {
			console.error("Error regenerating CSS after theme change:", error)
		}
	}

	/**
	 * Dispose of the server manager
	 */
	public dispose(): void {
		this.stopThemeWatcher()
		if (this.viteServer) {
			this.stop().catch(console.error)
		}
		PreviewServerManager.instance = undefined
	}
}
