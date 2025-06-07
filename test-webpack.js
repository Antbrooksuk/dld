// Simple test script to validate webpack dev server works
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const path = require('path');

// Simple webpack config for testing
const config = {
  mode: 'development',
  entry: './preview/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'preview'),
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'preview'),
    },
    port: 9132,
    host: 'localhost',
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
};

const compiler = webpack(config);
const devServer = new WebpackDevServer(config.devServer, compiler);

console.log('Starting webpack dev server on http://localhost:9132');

devServer.startCallback((err) => {
  if (err) {
    console.error('Failed to start dev server:', err);
  } else {
    console.log('✅ Webpack dev server started successfully!');
    console.log('🌐 Open http://localhost:9132 in your browser to test');
    console.log('📦 Bundle should show React component');
    console.log('Press Ctrl+C to stop');
  }
});