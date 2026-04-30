import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesium from "vite-plugin-cesium";
import { visualizer } from "rollup-plugin-visualizer";
import viteCompression from "vite-plugin-compression";
import type { Plugin } from "vite";
// import { devMonitorPlugin } from "./scripts/dev-monitor";

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        cesium(),
        // devMonitorPlugin(), // 暂时注释掉，避免导入错误

        // 构建分析插件 - 生成可视化报告
        visualizer({
            filename: "dist/stats.html",
            open: false, // 构建完成后不自动打开
            gzipSize: true,
            brotliSize: true,
            template: "treemap", // 可选: treemap, sunburst, network
        }) as Plugin,

        // 只启用 Gzip 压缩，更稳定
        viteCompression({
            verbose: true, // 显示压缩结果
            disable: false,
            threshold: 1024,
            algorithm: "gzip",
            ext: ".gz",
            deleteOriginFile: false, // 保留原文件
            compressionOptions: {
                level: 9, // 最高压缩级别
            },
        }),

        // Brotli 压缩 - 压缩率更高，现代浏览器支持
        viteCompression({
            verbose: true,
            disable: false,
            threshold: 1024,
            algorithm: "brotliCompress",
            ext: ".br",
            compressionOptions: {
                level: 11,
            },
        }),
    ],

    build: {
        // 启用详细的构建报告
        reportCompressedSize: true,

        // 启用更激进的压缩
        minify: "terser",
        terserOptions: {
            compress: {
                drop_console: true, // 移除 console.log
                drop_debugger: true, // 移除 debugger
                pure_funcs: ["console.log", "console.info", "console.debug"],
                passes: 3, // 增加压缩轮数
                unsafe: true, // 启用不安全优化
                unsafe_comps: true,
                unsafe_math: true,
                unsafe_methods: true,
                unsafe_proto: true,
                unsafe_regexp: true,
                unsafe_undefined: true,
                dead_code: true,
                unused: true,
            },
            mangle: {
                safari10: true,
                toplevel: true, // 混淆顶级作用域
            },
            format: {
                comments: false,
            },
        },

        rollupOptions: {
            output: {
                manualChunks(id) {
                    // Cesium 相关包 - 最大的依赖
                    if (
                        id.includes("node_modules/cesium") ||
                        id.includes("node_modules/@types/cesium") ||
                        id.includes("node_modules/resium")
                    ) {
                        return "cesium";
                    }

                    // React 核心包
                    if (
                        id.includes("node_modules/react/") ||
                        id.includes("node_modules/react-dom/")
                    ) {
                        return "react-core";
                    }

                    // React 路由和相关
                    if (id.includes("node_modules/react-router")) {
                        return "react-router";
                    }

                    // UI组件库
                    if (
                        id.includes("node_modules/@mui") ||
                        id.includes("node_modules/antd") ||
                        id.includes("node_modules/@ant-design")
                    ) {
                        return "ui-libs";
                    }

                    // 工具库
                    if (
                        id.includes("node_modules/lodash") ||
                        id.includes("node_modules/moment") ||
                        id.includes("node_modules/dayjs") ||
                        id.includes("node_modules/date-fns")
                    ) {
                        return "utils";
                    }

                    // 图表和可视化库
                    if (
                        id.includes("node_modules/echarts") ||
                        id.includes("node_modules/d3") ||
                        id.includes("node_modules/three")
                    ) {
                        return "charts";
                    }

                    // 其他第三方库
                    if (id.includes("node_modules")) {
                        // 按大小分割大型库
                        if (
                            id.includes("node_modules/@babel") ||
                            id.includes("node_modules/core-js")
                        ) {
                            return "polyfills";
                        }
                        return "vendor";
                    }

                    // 应用代码按功能分割
                    if (id.includes("src/view/")) {
                        return "views";
                    }
                    if (id.includes("src/components/")) {
                        return "components";
                    }
                    if (id.includes("src/utils/")) {
                        return "app-utils";
                    }

                    // 默认应用代码
                    return "app";
                },

                // 优化文件名和分包
                chunkFileNames: chunkInfo => {
                    // 为不同类型的chunk使用不同的命名策略
                    if (chunkInfo.name === "cesium") {
                        return "js/cesium-[hash].js";
                    }
                    if (chunkInfo.name === "react-core") {
                        return "js/react-[hash].js";
                    }
                    return "js/[name]-[hash].js";
                },
                entryFileNames: "js/main-[hash].js",
                assetFileNames: assetInfo => {
                    if (!assetInfo.name) {
                        return "assets/[name]-[hash][extname]";
                    }

                    const info = assetInfo.name.split(".");
                    const ext = info[info.length - 1];

                    if (
                        /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(
                            assetInfo.name
                        )
                    ) {
                        return `media/[name]-[hash].${ext}`;
                    }
                    if (
                        /\.(png|jpe?g|gif|svg|ico|webp)(\?.*)?$/i.test(
                            assetInfo.name
                        )
                    ) {
                        return `img/[name]-[hash].${ext}`;
                    }
                    if (ext === "css") {
                        return `css/[name]-[hash].${ext}`;
                    }
                    if (
                        /\.(woff|woff2|eot|ttf|otf)(\?.*)?$/i.test(
                            assetInfo.name
                        )
                    ) {
                        return `fonts/[name]-[hash].${ext}`;
                    }
                    return `assets/[name]-[hash].${ext}`;
                },
            },

            // 外部化大型依赖（可选）
            external: () => {
                // 如果你想从CDN加载某些库，可以在这里配置
                return false;
            },
        },

        chunkSizeWarningLimit: 2000, // 降低到2MB

        // 启用CSS代码分割
        cssCodeSplit: true,

        // 优化资源内联阈值
        assetsInlineLimit: 4096, // 4KB以下的资源内联
    },

    // 开发服务器配置
    server: {
        // 在开发模式下也显示一些统计信息
        middlewareMode: false,
    },

    // 优化依赖预构建
    optimizeDeps: {
        include: ["react", "react-dom", "cesium"],
        exclude: [
            // 排除不需要预构建的包
        ],
    },

    // 定义全局常量
    define: {
        __DEV__: JSON.stringify(process.env.NODE_ENV === "development"),
        __PROD__: JSON.stringify(process.env.NODE_ENV === "production"),
    },
});
