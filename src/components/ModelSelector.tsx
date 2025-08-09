import React from 'react';
import { ModelInfo } from '../types';
import './ModelSelector.css';

interface ModelSelectorProps {
  models: ModelInfo[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  isLoading: boolean;
  error: string | null;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  onModelChange,
  isLoading,
  error
}) => {
  return (
    <div className="model-selector-container">
      <label htmlFor="model-select" className="model-label">
        Model:
      </label>
      <select
        id="model-select"
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        className="model-select"
        disabled={isLoading}
      >
        {isLoading ? (
          <option value={selectedModel}>Loading models...</option>
        ) : error ? (
          <option value={selectedModel}>{selectedModel} (using fallback)</option>
        ) : models.length === 0 ? (
          <option value={selectedModel}>{selectedModel} (default)</option>
        ) : (
          models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.id}
              {model.litellm_provider && ` (${model.litellm_provider})`}
            </option>
          ))
        )}
      </select>
      {error && (
        <div className="model-error">
          Failed to load models. Using default.
        </div>
      )}
    </div>
  );
};
