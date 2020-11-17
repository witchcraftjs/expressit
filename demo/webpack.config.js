const HtmlWebpackPlugin = require("html-webpack-plugin")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const path = require("path")
const webpack = require("webpack")


module.exports = {
	entry: "./demo.js",
	devServer: {
		contentBase: "./dist",
		host: "0.0.0.0",
	},
	output: {
		filename: "[name].bundle.js",
		path: path.resolve(__dirname, "dist"),
		// see https://github.com/webpack/webpack/issues/11660
		chunkLoading: false,
		wasmLoading: false,
	},
	plugins: [
		new HtmlWebpackPlugin(),
	],
	resolve: {
		fallback: {
			util: false,
			child_process: false,
			path: false,
		},
	},
	module: {
		rules: [
			{
				test: /\.css$/i,
				use: ["style-loader", "css-loader"],
			},
		],
	},
}
