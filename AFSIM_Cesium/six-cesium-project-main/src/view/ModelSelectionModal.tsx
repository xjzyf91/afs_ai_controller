// Add this to the existing imports
import React from "react";
import "./ModelSelectionModal.css";

export function ModelSelectionModal({
    onClose,
    onSelectLocal,
    onSelectExisting,
}) {
    return (
        <div className="modal-overlay">
            <div className="retro-modal crt-effect">
                <div className="modal-header">
                    <h2 className="pixel-font">选择模型来源</h2>
                    <button className="close-btn pixel-font" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="modal-body scanlines">
                    <div className="selection-options">
                        <button
                            className="retro-button local-model-btn pixel-font"
                            onClick={onSelectLocal}
                        >
                            <span className="button-icon">💾</span> 本地模型
                        </button>
                        <button
                            className="retro-button existing-model-btn pixel-font"
                            onClick={onSelectExisting}
                        >
                            <span className="button-icon">📦</span> 现存模型
                        </button>
                    </div>
                </div>
                <div className="modal-footer pixel-font">
                    <p>请选择模型来源方式</p>
                </div>
            </div>
        </div>
    );
}
