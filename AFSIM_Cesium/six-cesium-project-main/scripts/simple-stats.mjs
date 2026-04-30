import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function analyzeDistFolder() {
    const distPath = "./dist";
    if (!fs.existsSync(distPath)) {
        console.log("❌ dist 目录不存在，请先运行构建");
        return;
    }

    const stats = {
        js: { count: 0, size: 0, files: [] },
        css: { count: 0, size: 0, files: [] },
        html: { count: 0, size: 0, files: [] },
        other: { count: 0, size: 0, files: [] },
    };

    function walkDir(dir) {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                walkDir(fullPath);
            } else {
                const relativePath = path.relative(distPath, fullPath);
                const size = stat.size;

                let type = "other";
                if (item.endsWith(".js") || item.endsWith(".mjs")) type = "js";
                else if (item.endsWith(".css")) type = "css";
                else if (item.endsWith(".html")) type = "html";

                stats[type].count++;
                stats[type].size += size;
                stats[type].files.push({ name: relativePath, size });
            }
        }
    }

    walkDir(distPath);

    // 打印统计结果
    console.log("\n📊 构建统计报告");
    console.log("=".repeat(60));

    console.log("\n📦 资源类型统计:");
    console.log(
        `JavaScript: ${stats.js.count} 个文件, ${formatBytes(stats.js.size)}`
    );
    console.log(
        `CSS: ${stats.css.count} 个文件, ${formatBytes(stats.css.size)}`
    );
    console.log(
        `HTML: ${stats.html.count} 个文件, ${formatBytes(stats.html.size)}`
    );
    console.log(
        `其他: ${stats.other.count} 个文件, ${formatBytes(stats.other.size)}`
    );

    const totalSize = Object.values(stats).reduce(
        (sum, stat) => sum + stat.size,
        0
    );
    const totalCount = Object.values(stats).reduce(
        (sum, stat) => sum + stat.count,
        0
    );
    console.log(`总计: ${totalCount} 个文件, ${formatBytes(totalSize)}`);

    // 显示最大的文件
    console.log("\n📋 最大的文件:");
    const allFiles = Object.values(stats).flatMap(stat => stat.files);
    const sortedFiles = allFiles.sort((a, b) => b.size - a.size).slice(0, 10);

    sortedFiles.forEach((file, index) => {
        console.log(
            `${(index + 1).toString().padStart(2)}. ${file.name.padEnd(
                40
            )} ${formatBytes(file.size)}`
        );
    });

    // Cesium 相关统计
    const cesiumFiles = allFiles.filter(f =>
        f.name.toLowerCase().includes("cesium")
    );
    if (cesiumFiles.length > 0) {
        const cesiumSize = cesiumFiles.reduce((sum, f) => sum + f.size, 0);
        console.log(
            `\n🌍 Cesium 相关文件: ${cesiumFiles.length} 个, ${formatBytes(
                cesiumSize
            )} (${((cesiumSize / totalSize) * 100).toFixed(1)}%)`
        );
    }

    console.log("\n" + "=".repeat(60));
}

// 执行构建和分析
console.log("🚀 开始构建项目...");
try {
    execSync("npx vite build", { stdio: "inherit" });
    console.log("✅ 构建完成!");
    analyzeDistFolder();
} catch (error) {
    console.error("❌ 构建失败:", error.message);
}
