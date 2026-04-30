import React from "react";
import "./FirstPage.css";

interface RealTimeDataProps {
    isRealTimeActive: boolean;
    realTimeData: {
        target: {
            position: { x: number; y: number; z: number };
            orientation: { yaw: number; pitch: number; roll: number };
        };
        missile: {
            position: { x: number; y: number; z: number };
            orientation: { yaw: number; pitch: number; roll: number };
        };
    };
    onClose?: () => void;
}

const RealTimeDataPanel: React.FC<RealTimeDataProps> = ({
    isRealTimeActive,
    realTimeData,
    onClose,
}) => {
    if (!isRealTimeActive) {
        return (
            <div className="data-panel">
                {onClose && (
                    <button className="data-panel-close" onClick={onClose}>
                        ×
                    </button>
                )}
                <div className="waiting-message">实时仿真未启动</div>
            </div>
        );
    }

    return (
        <div className="data-panel">
            {onClose && (
                <button className="data-panel-close" onClick={onClose}>
                    ×
                </button>
            )}
            <div className="real-time-data">
                <h3>实时仿真数据</h3>
                <div className="data-section target-data">
                    <h4>目标数据:</h4>
                    <div className="data-row">
                        <div className="data-group">
                            <span className="data-label">位置:</span>
                            <span className="data-value">
                                X: {realTimeData.target.position.x.toFixed(2)} m
                                Y: {realTimeData.target.position.y.toFixed(2)} m
                                Z: {realTimeData.target.position.z.toFixed(2)} m
                            </span>
                        </div>
                        <div className="data-group">
                            <span className="data-label">姿态:</span>
                            <span className="data-value">
                                偏航:{" "}
                                {realTimeData.target.orientation.yaw.toFixed(2)}
                                ° 俯仰:{" "}
                                {realTimeData.target.orientation.pitch.toFixed(
                                    2
                                )}
                                ° 滚转:{" "}
                                {realTimeData.target.orientation.roll.toFixed(
                                    2
                                )}
                                °
                            </span>
                        </div>
                    </div>
                </div>
                <div className="data-section missile-data">
                    <h4>导弹数据:</h4>
                    <div className="data-row">
                        <div className="data-group">
                            <span className="data-label">位置:</span>
                            <span className="data-value">
                                X: {realTimeData.missile.position.x.toFixed(2)}{" "}
                                m Y:{" "}
                                {realTimeData.missile.position.y.toFixed(2)} m
                                Z: {realTimeData.missile.position.z.toFixed(2)}{" "}
                                m
                            </span>
                        </div>
                        <div className="data-group">
                            <span className="data-label">姿态:</span>
                            <span className="data-value">
                                偏航:{" "}
                                {realTimeData.missile.orientation.yaw.toFixed(
                                    2
                                )}
                                ° 俯仰:{" "}
                                {realTimeData.missile.orientation.pitch.toFixed(
                                    2
                                )}
                                ° 滚转:{" "}
                                {realTimeData.missile.orientation.roll.toFixed(
                                    2
                                )}
                                °
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RealTimeDataPanel;
