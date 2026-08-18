import path from 'node:path';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import ESLintPlugin from 'eslint-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import type { Configuration, ExternalItemFunctionData } from 'webpack';

const externals: Configuration['externals'] = [
  'react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom',
  /^@grafana\/ui/i, /^@grafana\/runtime/i, /^@grafana\/data/i,
  ({ request }: ExternalItemFunctionData, callback: (error?: Error, result?: string) => void) => {
    if (request?.startsWith('grafana/')) return callback(undefined, request.slice('grafana/'.length));
    callback();
  },
];

export default (env: Record<string, unknown>): Configuration => ({
  context: path.resolve(process.cwd(), 'src'),
  mode: env.production ? 'production' : 'development',
  devtool: env.production ? 'source-map' : 'eval-source-map',
  entry: { module: './module.ts' },
  externals,
  module: {
    rules: [{
      test: /\.[tj]sx?$/,
      exclude: /node_modules/,
      use: { loader: 'swc-loader', options: { jsc: { target: 'es2019', parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } } } },
    }],
  },
  resolve: { extensions: ['.ts', '.tsx', '.js', '.jsx'], modules: [path.resolve(process.cwd(), 'src'), 'node_modules'] },
  output: {
    clean: true,
    filename: '[name].js',
    path: path.resolve(process.cwd(), 'dist'),
    publicPath: 'public/plugins/kobzevra-production-timeline-panel/',
    uniqueName: 'kobzevra-production-timeline-panel',
    library: { type: 'amd' },
  },
  optimization: { minimize: Boolean(env.production), minimizer: [new TerserPlugin({ extractComments: false })] },
  plugins: [
    new CopyWebpackPlugin({ patterns: [
      { from: 'plugin.json', to: 'plugin.json' },
      { from: 'img', to: 'img', noErrorOnMissing: true },
      { from: '../README.md', to: 'README.md', noErrorOnMissing: true },
      { from: '../LICENSE', to: 'LICENSE', noErrorOnMissing: true },
    ] }),
    new ForkTsCheckerWebpackPlugin({ typescript: { configFile: path.resolve(process.cwd(), 'tsconfig.json') } }),
    new ESLintPlugin({ extensions: ['ts', 'tsx'], failOnError: Boolean(env.production) }),
  ],
});
