import path from 'path';
import webpack from 'webpack';

/**
 * Creates a webpack configuration for component preview
 * Based on react-preview-extension implementation
 */
export function createPreviewWebpackConfig(extensionPath: string, workspacePath: string): webpack.Configuration {
  return {
    mode: 'development',
    context: path.resolve(extensionPath, 'preview'),
    entry: path.resolve(extensionPath, 'preview', 'index.js'),
    output: {
      filename: 'bundle.js',
      path: path.resolve(extensionPath, 'preview'),
    },
    plugins: [
      // Automatically provide React to all modules
      new webpack.ProvidePlugin({
        React: 'react',
      }),
    ],
    devtool: 'source-map',
    resolve: {
      modules: [
        // Look for modules in both extension and workspace node_modules
        path.resolve(extensionPath, 'node_modules'),
        path.resolve(workspacePath, 'node_modules'),
      ],
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: require.resolve('babel-loader'),
            options: {
              presets: [
                [require.resolve('@babel/preset-env'), { targets: { node: 'current' } }],
                [require.resolve('@babel/preset-react'), { runtime: 'automatic' }],
                [require.resolve('@babel/preset-typescript')]
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: [require.resolve('style-loader'), require.resolve('css-loader')],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
        },
      ],
    },
    cache: true,
    stats: 'errors-only',
    devServer: {
      static: {
        directory: path.resolve(extensionPath, 'preview'),
        watch: true,
      },
      port: 9132,
      host: 'localhost',
      client: {
        overlay: false,
        logging: 'none' as const,
      },
      hot: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
      },
    },
  };
}

export default createPreviewWebpackConfig;