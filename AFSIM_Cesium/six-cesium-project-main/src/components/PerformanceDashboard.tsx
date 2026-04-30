import React, { useState, useEffect } from "react";
import { performanceOptimizer } from "../utils/performanceOptimization";
import "./PerformanceDashboard.css";

interface PerformanceMetrics {
    fcp?: number;
    lcp?: number;
    fid?: number;
    cls?: number;
    ttfb?: number;
    tti?: number; // Time to Interactive
    tbt?: number; // Total Blocking Time
    si?: number; // Speed Index
    domContentLoaded?: number;
    loadComplete?: number;
    memoryUsage?: {
        used: number;
        total: number;
        limit: number;
    };
}

interface PerformanceDashboardProps {
    isVisible: boolean;
    onToggle: () => void;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
    isVisible,
    onToggle,
}) => {
    const [metrics, setMetrics] = useState<PerformanceMetrics>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isVisible) return;

        // 初始获取指标
        const updateMetrics = () => {
            const currentMetrics = performanceOptimizer.getMetrics();
            setMetrics(currentMetrics);

            // 如果TTI已经测量完成，停止加载状态
            if (currentMetrics.tti !== undefined) {
                setIsLoading(false);
            }
        };

        updateMetrics();

        // 定期更新指标
        const interval = setInterval(updateMetrics, 1000);

        // 设置最大等待时间
        const timeout = setTimeout(() => {
            setIsLoading(false);
        }, 12000); // 12秒后强制停止加载

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [isVisible]);

    const formatMetric = (value?: number, unit = "ms") => {
        if (value === undefined) return "测量中...";
        return `${Math.round(value)}${unit}`;
    };

    const getScoreColor = (
        value: number,
        thresholds: { good: number; poor: number }
    ) => {
        if (value <= thresholds.good) return "#0cce6b";
        if (value <= thresholds.poor) return "#ffa400";
        return "#ff4e42";
    };

    const getScoreLabel = (
        value: number,
        thresholds: { good: number; poor: number }
    ) => {
        if (value <= thresholds.good) return "良好";
        if (value <= thresholds.poor) return "需要改进";
        return "差";
    };

    if (!isVisible) return null;

    return (
        <div className="performance-dashboard">
            <div className="dashboard-header">
                <h3>性能监控仪表板</h3>
                <button className="close-btn" onClick={onToggle}>
                    ×
                </button>
            </div>

            {isLoading && (
                <div className="loading-indicator">
                    <div className="spinner"></div>
                    <span>正在测量性能指标...</span>
                </div>
            )}

            <div className="metrics-grid">
                {/* Core Web Vitals */}
                <div className="metric-section">
                    <h4>核心网页指标 (Core Web Vitals)</h4>

                    <div className="metric-item">
                        <div className="metric-label">
                            <span>LCP (最大内容绘制)</span>
                            <span className="metric-info">目标: &lt;2.5s</span>
                        </div>
                        <div className="metric-value">
                            <span
                                style={{
                                    color: metrics.lcp
                                        ? getScoreColor(metrics.lcp, {
                                              good: 2500,
                                              poor: 4000,
                                          })
                                        : "#666",
                                }}
                            >
                                {formatMetric(metrics.lcp)}
                            </span>
                            {metrics.lcp && (
                                <span className="metric-score">
                                    {getScoreLabel(metrics.lcp, {
                                        good: 2500,
                                        poor: 4000,
                                    })}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="metric-item">
                        <div className="metric-label">
                            <span>FID (首次输入延迟)</span>
                            <span className="metric-info">目标: &lt;100ms</span>
                        </div>
                        <div className="metric-value">
                            <span
                                style={{
                                    color: metrics.fid
                                        ? getScoreColor(metrics.fid, {
                                              good: 100,
                                              poor: 300,
                                          })
                                        : "#666",
                                }}
                            >
                                {formatMetric(metrics.fid)}
                            </span>
                            {metrics.fid && (
                                <span className="metric-score">
                                    {getScoreLabel(metrics.fid, {
                                        good: 100,
                                        poor: 300,
                                    })}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="metric-item">
                        <div className="metric-label">
                            <span>CLS (累积布局偏移)</span>
                            <span className="metric-info">目标: &lt;0.1</span>
                        </div>
                        <div className="metric-value">
                            <span
                                style={{
                                    color: metrics.cls
                                        ? getScoreColor(metrics.cls, {
                                              good: 0.1,
                                              poor: 0.25,
                                          })
                                        : "#666",
                                }}
                            >
                                {metrics.cls !== undefined
                                    ? metrics.cls.toFixed(3)
                                    : "测量中..."}
                            </span>
                            {metrics.cls !== undefined && (
                                <span className="metric-score">
                                    {getScoreLabel(metrics.cls, {
                                        good: 0.1,
                                        poor: 0.25,
                                    })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 其他重要指标 */}
                <div className="metric-section">
                    <h4>其他性能指标</h4>

                    <div className="metric-item">
                        <div className="metric-label">
                            <span>FCP (首次内容绘制)</span>
                            <span className="metric-info">目标: &lt;1.8s</span>
                        </div>
                        <div className="metric-value">
                            <span
                                style={{
                                    color: metrics.fcp
                                        ? getScoreColor(metrics.fcp, {
                                              good: 1800,
                                              poor: 3000,
                                          })
                                        : "#666",
                                }}
                            >
                                {formatMetric(metrics.fcp)}
                            </span>
                            {metrics.fcp && (
                                <span className="metric-score">
                                    {getScoreLabel(metrics.fcp, {
                                        good: 1800,
                                        poor: 3000,
                                    })}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="metric-item">
                        <div className="metric-label">
                            <span>TTI (可交互时间)</span>
                            <span className="metric-info">目标: &lt;5s</span>
                        </div>
                        <div className="metric-value">
                            <span
                                style={{
                                    color: metrics.tti
                                        ? getScoreColor(metrics.tti, {
                                              good: 5000,
                                              poor: 10000,
                                          })
                                        : "#666",
                                }}
                            >
                                {formatMetric(metrics.tti)}
                            </span>
                            {metrics.tti && (
                                <span className="metric-score">
                                    {getScoreLabel(metrics.tti, {
                                        good: 5000,
                                        poor: 10000,
                                    })}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="metric-item">
                        <div className="metric-label">
                            <span>TTFB (首字节时间)</span>
                            <span className="metric-info">目标: &lt;600ms</span>
                        </div>
                        <div className="metric-value">
                            <span
                                style={{
                                    color: metrics.ttfb
                                        ? getScoreColor(metrics.ttfb, {
                                              good: 600,
                                              poor: 1500,
                                          })
                                        : "#666",
                                }}
                            >
                                {formatMetric(metrics.ttfb)}
                            </span>
                            {metrics.ttfb && (
                                <span className="metric-score">
                                    {getScoreLabel(metrics.ttfb, {
                                        good: 600,
                                        poor: 1500,
                                    })}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="metric-item">
                        <div className="metric-label">
                            <span>DOM 内容加载</span>
                            <span className="metric-info">DOM解析完成时间</span>
                        </div>
                        <div className="metric-value">
                            <span>
                                {formatMetric(metrics.domContentLoaded)}
                            </span>
                        </div>
                    </div>

                    <div className="metric-item">
                        <div className="metric-label">
                            <span>页面完全加载</span>
                            <span className="metric-info">
                                所有资源加载完成
                            </span>
                        </div>
                        <div className="metric-value">
                            <span>{formatMetric(metrics.loadComplete)}</span>
                        </div>
                    </div>
                </div>

                {/* 内存使用情况 */}
                {metrics.memoryUsage && (
                    <div className="metric-section">
                        <h4>内存使用情况</h4>

                        <div className="metric-item">
                            <div className="metric-label">
                                <span>已使用内存</span>
                            </div>
                            <div className="metric-value">
                                <span>
                                    {formatMetric(
                                        metrics.memoryUsage.used,
                                        "MB"
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="metric-item">
                            <div className="metric-label">
                                <span>总分配内存</span>
                            </div>
                            <div className="metric-value">
                                <span>
                                    {formatMetric(
                                        metrics.memoryUsage.total,
                                        "MB"
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="metric-item">
                            <div className="metric-label">
                                <span>内存限制</span>
                            </div>
                            <div className="metric-value">
                                <span>
                                    {formatMetric(
                                        metrics.memoryUsage.limit,
                                        "MB"
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="memory-usage-bar">
                            <div
                                className="memory-used"
                                style={{
                                    width: `${
                                        (metrics.memoryUsage.used /
                                            metrics.memoryUsage.limit) *
                                        100
                                    }%`,
                                    backgroundColor:
                                        metrics.memoryUsage.used /
                                            metrics.memoryUsage.limit >
                                        0.8
                                            ? "#ff4e42"
                                            : "#0cce6b",
                                }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            <div className="dashboard-footer">
                <small>
                    性能指标每秒更新一次 •
                    {isLoading ? " 测量中..." : " 测量完成"}
                </small>
            </div>
        </div>
    );
};

export default PerformanceDashboard;
