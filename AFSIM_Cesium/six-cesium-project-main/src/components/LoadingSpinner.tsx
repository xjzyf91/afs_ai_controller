import React from "react";
import "./LoadingSpinner.css";

const LoadingSpinner: React.FC = () => {
    return (
        <div className="loading-container">
            <div className="stars-background"></div>
            <div className="loading-content">
                <div className="earth-icon">
                    <div className="earth-inner">
                        <div className="continent continent-1"></div>
                        <div className="continent continent-2"></div>
                    </div>
                </div>
                <h2 className="loading-title">飞行器可视化仿真软件</h2>
                <p className="loading-subtitle">正在加载核心组件...</p>
                <div className="progress-container">
                    <div className="progress-bar"></div>
                </div>
                <div className="loading-dots">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <span className="loading-text">加载中</span>
                </div>
            </div>
        </div>
    );
};

export default LoadingSpinner;
