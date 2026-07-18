import React, { useState, useEffect } from 'react';
import { Plus, Trash, X, Save, AlertTriangle } from 'lucide-react';
import { ApplicationProfile, CheckEndpoint } from '../types';

interface ApplicationFormProps {
  application?: ApplicationProfile;
  onSave: (app: Partial<ApplicationProfile>) => void;
  onClose: () => void;
}

export default function ApplicationForm({ application, onSave, onClose }: ApplicationFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [githubRepository, setGithubRepository] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [deploymentPlatform, setDeploymentPlatform] = useState<ApplicationProfile['deploymentPlatform']>('Unknown');
  const [endpoints, setEndpoints] = useState<CheckEndpoint[]>([]);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (application) {
      setName(application.name);
      setUrl(application.url);
      setDescription(application.description);
      setGithubRepository(application.githubRepository || '');
      setGithubToken(application.githubToken || '');
      setDeploymentPlatform(application.deploymentPlatform || 'Unknown');
      setEndpoints(application.checkEndpoints);
    } else {
      setName('');
      setUrl('');
      setDescription('');
      setGithubRepository('');
      setGithubToken('');
      setDeploymentPlatform('Unknown');
      // Initialize with a default health endpoint for ease of use
      setEndpoints([
        {
          id: 'ep_' + Math.random().toString(36).substring(2, 9),
          path: '/api/health',
          method: 'GET',
          expectedStatus: 200,
          description: 'Liveness Probe'
        }
      ]);
    }
  }, [application]);

  const addEndpoint = () => {
    setEndpoints([
      ...endpoints,
      {
        id: 'ep_' + Math.random().toString(36).substring(2, 9),
        path: '/',
        method: 'GET',
        expectedStatus: 200,
        description: 'Check endpoint'
      }
    ]);
  };

  const removeEndpoint = (id: string) => {
    setEndpoints(endpoints.filter(ep => ep.id !== id));
  };

  const updateEndpoint = (id: string, fields: Partial<CheckEndpoint>) => {
    setEndpoints(endpoints.map(ep => ep.id === id ? { ...ep, ...fields } as CheckEndpoint : ep));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!name.trim()) {
      setValidationError('Application Name is required.');
      return;
    }

    if (!url.trim()) {
      setValidationError('Target URL is required.');
      return;
    }

    if (endpoints.length === 0) {
      setValidationError('At least one verification endpoint is required.');
      return;
    }

    // Basic URL validation pattern
    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'http://' + cleanUrl;
    }

    onSave({
      id: application?.id,
      name: name.trim(),
      url: cleanUrl,
      description: description.trim(),
      deploymentPlatform,
      checkEndpoints: endpoints,
      githubRepository: githubRepository.trim() || undefined,
      githubToken: githubToken.trim() || undefined
    });
  };

  return (
    <div id="app-form-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div id="app-form-modal" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {application ? 'Edit Application Profile' : 'Configure New GCP App Target'}
          </h3>
          <button 
            id="close-form-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {validationError && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg flex items-start gap-2.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Application Name *
              </label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g., Payment Gateway Service"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-500 transition-shadow"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Target Platform / Service
              </label>
              <select 
                value={deploymentPlatform} 
                onChange={e => setDeploymentPlatform(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
              >
                <option value="Unknown">Select Platform (Optional)</option>
                <option value="Cloud Run">Cloud Run (Serverless containers)</option>
                <option value="GKE">Google Kubernetes Engine (GKE)</option>
                <option value="Compute Engine">Compute Engine (VMs)</option>
                <option value="Cloud Functions">Cloud Functions (Events)</option>
                <option value="App Engine">App Engine (PaaS)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Base URL *
            </label>
            <input 
              type="text" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="e.g., https://payment-service-x28js.run.app"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-500 transition-shadow"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Supports secure TLS (https://) or internal simulation host targets.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Target Description
            </label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="What does this service do, and what cloud systems does it integrate with?"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-500 transition-shadow resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                GitHub Repository (Optional)
              </label>
              <input 
                type="text" 
                value={githubRepository} 
                onChange={e => setGithubRepository(e.target.value)} 
                placeholder="e.g., owner/repo"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-500 transition-shadow"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                GitHub PAT (Optional)
              </label>
              <input 
                type="password" 
                value={githubToken} 
                onChange={e => setGithubToken(e.target.value)} 
                placeholder="Token for fetching commits & raising PRs"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-500 transition-shadow"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Sanity-Check Endpoints ({endpoints.length})
              </span>
              <button 
                type="button" 
                onClick={addEndpoint}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 py-1 px-2 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Endpoint
              </button>
            </div>

            <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1">
              {endpoints.map((ep, idx) => (
                <div 
                  key={ep.id} 
                  className="p-3.5 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-lg flex flex-col gap-3 relative group"
                >
                  <button
                    type="button"
                    onClick={() => removeEndpoint(ep.id)}
                    className="absolute right-2 top-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                    title="Delete endpoint"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                    <div className="md:col-span-2">
                      <select
                        value={ep.method}
                        onChange={e => updateEndpoint(ep.id, { method: e.target.value as any })}
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-md text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>

                    <div className="md:col-span-6">
                      <input
                        type="text"
                        value={ep.path}
                        onChange={e => updateEndpoint(ep.id, { path: e.target.value })}
                        placeholder="Path e.g., /api/health"
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-md text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
                      />
                    </div>

                    <div className="md:col-span-4 pr-6">
                      <input
                        type="number"
                        value={ep.expectedStatus}
                        onChange={e => updateEndpoint(ep.id, { expectedStatus: parseInt(e.target.value) || 200 })}
                        placeholder="Status e.g. 200"
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded-md text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div>
                      <input
                        type="text"
                        value={ep.expectedKeyword || ''}
                        onChange={e => updateEndpoint(ep.id, { expectedKeyword: e.target.value })}
                        placeholder="Expected text in body (Optional)"
                        className="w-full px-2.5 py-1 border border-gray-200 dark:border-gray-800 rounded-md text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={ep.description || ''}
                        onChange={e => updateEndpoint(ep.id, { description: e.target.value })}
                        placeholder="Label/description (e.g., Users database)"
                        className="w-full px-2.5 py-1 border border-gray-200 dark:border-gray-800 rounded-md text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4.5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg shadow-sm transition-all"
          >
            <Save className="w-4 h-4" />
            Save Profile
          </button>
        </div>

      </div>
    </div>
  );
}
