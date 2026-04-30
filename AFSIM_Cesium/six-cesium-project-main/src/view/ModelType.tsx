import React from "react";

const MODEL_TYPES = [
    { id: "f22", name: "f22" },
    { id: "PL12", name: "PL12" },
    { id: "PL10E1", name: "PL10E1" },
    { id: "E3", name: "E3" },
    { id: "B52", name: "B52" },
];

export function ModelTypeModal({ onClose, onSelectModelType }) {
    return (
        <div className="modal-overlay">
            <div className="retro-modal model-type-modal">
                <div className="modal-header">
                    <h2>选择模型类型</h2>
                    <button className="close-btn" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="modal-body">
                    <div className="model-type-grid">
                        {MODEL_TYPES.map(model => (
                            <button
                                key={model.id}
                                className="retro-button model-type-btn"
                                onClick={() => onSelectModelType(model.id)}
                            >
                                {model.name}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="modal-footer">
                    <p>请从列表中选择模型类型</p>
                </div>
            </div>
        </div>
    );
}
