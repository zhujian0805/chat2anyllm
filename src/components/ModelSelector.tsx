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
  // Sort models by provider, then by model name
  const sortedModels = [...models].sort((a, b) => {
    const providerA = a.litellm_provider || '';
    const providerB = b.litellm_provider || '';
    
    // First sort by provider
    if (providerA !== providerB) {
      return providerA.localeCompare(providerB);
    }
    
    // If providers are the same, sort by model name
    return a.id.localeCompare(b.id);
  });

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
        ) : sortedModels.length === 0 ? (
          <option value={selectedModel}>{selectedModel} (default)</option>
        ) : (
          sortedModels.map((model) => (
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
