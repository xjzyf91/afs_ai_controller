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

    const originalFiles = [];
    const compressedFiles = [];

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

                if (item.endsWith(".gz")) {
                    compressedFiles.push({
                        name: relativePath,
                        size: size,
                        type: "gzip",
                        originalName: relativePath.replace(".gz", ""),
                    });
                } else if (item.endsWith(".br")) {
                    compressedFiles.push({
                        name: relativePath,
                        size: size,
                        type: "brotli",
                        originalName: relativePath.replace(".br", ""),
                    });
                } else {
                    // 原始文件
                    let type = "other";
                    if (item.endsWith(".js") || item.endsWith(".mjs"))
                        type = "js";
                    else if (item.endsWith(".css")) type = "css";
                    else if (item.endsWith(".html")) type = "html";

                    originalFiles.push({
                        name: relativePath,
                        size: size,
                        type: type,
                        isCesium:
                            relativePath.toLowerCase().includes("cesium") ||
                            relativePath.toLowerCase().includes("workers") ||
                            relativePath.toLowerCase().includes("assets"),
                    });
                }
            }
        }
    }

    walkDir(distPath);

    // 统计原始文件
    const stats = {
        js: { count: 0, size: 0, compressedSize: 0 },
        css: { count: 0, size: 0, compressedSize: 0 },
        html: { count: 0, size: 0, compressedSize: 0 },
        other: { count: 0, size: 0, compressedSize: 0 },
    };

    let cesiumTotalSize = 0;
    let cesiumCompressedSize = 0;
    let cesiumFileCount = 0;

    originalFiles.forEach(file => {
        stats[file.type].count++;
        stats[file.type].size += file.size;

        if (file.isCesium) {
            cesiumTotalSize += file.size;
            cesiumFileCount++;
        }

        // 查找对应的压缩文件
        const gzipFile = compressedFiles.find(
            cf => cf.originalName === file.name && cf.type === "gzip"
        );
        if (gzipFile) {
            stats[file.type].compressedSize += gzipFile.size;
            if (file.isCesium) {
                cesiumCompressedSize += gzipFile.size;
            }
        }
    });

    // 打印详细统计
    console.log("\n📊 构建统计报告 (修正版)");
    console.log("=".repeat(80));

    console.log("\n📦 文件类型统计:");

    Object.entries(stats).forEach(([type, data]) => {
        const typeName = {
            js: "JavaScript",
            css: "CSS",
            html: "HTML",
            other: "其他资源",
        }[type];

        if (data.count > 0) {
            console.log(`\n${typeName}:`);
            console.log(`  文件数量: ${data.count} 个`);
            console.log(`  原始大小: ${formatBytes(data.size)}`);

            if (data.compressedSize > 0) {
                const ratio = (
                    ((data.size - data.compressedSize) / data.size) *
                    100
                ).toFixed(1);
                console.log(
                    `  Gzip 压缩: ${formatBytes(
                        data.compressedSize
                    )} (节省 ${ratio}%)`
                );
            } else {
                console.log(`  Gzip 压缩: 未压缩`);
            }
        }
    });

    const totalOriginal = Object.values(stats).reduce(
        (sum, stat) => sum + stat.size,
        0
    );
    const totalCompressed = Object.values(stats).reduce(
        (sum, stat) => sum + stat.compressedSize,
        0
    );
    const totalCount = Object.values(stats).reduce(
        (sum, stat) => sum + stat.count,
        0
    );

    console.log("\n📈 总体统计:");
    console.log(`总文件数: ${totalCount} 个`);
    console.log(`原始总大小: ${formatBytes(totalOriginal)}`);

    if (totalCompressed > 0) {
        const totalRatio = (
            ((totalOriginal - totalCompressed) / totalOriginal) *
            100
        ).toFixed(1);
        console.log(
            `Gzip 压缩后: ${formatBytes(totalCompressed)} (节省 ${totalRatio}%)`
        );
        console.log(
            `实际节省: ${formatBytes(totalOriginal - totalCompressed)}`
        );
    } else {
        console.log(`Gzip 压缩: 未启用或失败`);
    }

    // Cesium 专项统计
    console.log("\n🌍 Cesium 相关文件详情:");
    console.log(`Cesium 文件数: ${cesiumFileCount} 个`);
    console.log(`Cesium 原始大小: ${formatBytes(cesiumTotalSize)}`);

    if (cesiumCompressedSize > 0) {
        const cesiumRatio = (
            ((cesiumTotalSize - cesiumCompressedSize) / cesiumTotalSize) *
            100
        ).toFixed(1);
        console.log(
            `Cesium 压缩后: ${formatBytes(
                cesiumCompressedSize
            )} (节省 ${cesiumRatio}%)`
        );
    } else {
        console.log(`Cesium 压缩: 未压缩 (可能被排除在压缩范围外)`);
    }

    console.log(
        `Cesium 占总体积: ${((cesiumTotalSize / totalOriginal) * 100).toFixed(
            1
        )}%`
    );

    // 显示最大的原始文件
    console.log("\n📋 最大的文件 (前10个):");
    const sortedFiles = originalFiles
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);

    sortedFiles.forEach((file, index) => {
        const gzipFile = compressedFiles.find(
            cf => cf.originalName === file.name && cf.type === "gzip"
        );
        const compressedInfo = gzipFile
            ? ` → ${formatBytes(gzipFile.size)} (${(
                  ((file.size - gzipFile.size) / file.size) *
                  100
              ).toFixed(1)}% 压缩)`
            : " (未压缩)";

        console.log(
            `${(index + 1).toString().padStart(2)}. ${file.name.padEnd(
                50
            )} ${formatBytes(file.size)}${compressedInfo}`
        );
    });

    // 检查压缩文件情况
    console.log("\n🔍 压缩文件检查:");
    console.log(
        `找到 .gz 文件: ${
            compressedFiles.filter(f => f.type === "gzip").length
        } 个`
    );
    console.log(
        `找到 .br 文件: ${
            compressedFiles.filter(f => f.type === "brotli").length
        } 个`
    );

    console.log("\n" + "=".repeat(80));
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
