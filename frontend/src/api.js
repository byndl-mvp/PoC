// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://poc-rvrj.onrender.com';

// Helper function for API URLs
export const apiUrl = (path) => {
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

// Helper function for authenticated requests
export const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('adminToken');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
};

// API Endpoints
export const api = {
  // Projects
  createProject: (data) => 
    authFetch(apiUrl('/api/projects'), {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    
  getProject: (projectId) => 
    authFetch(apiUrl(`/api/projects/${projectId}`)),
    
  // Intake
  generateIntakeQuestions: (projectId) =>
    authFetch(apiUrl(`/api/projects/${projectId}/intake/questions`), {
      method: 'POST',
    }),
    
  getIntakeSummary: (projectId) =>
    authFetch(apiUrl(`/api/projects/${projectId}/intake/summary`)),
    
  // Trade Questions
  generateTradeQuestions: (projectId, tradeId) =>
    authFetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/questions`), {
      method: 'POST',
    }),
    
  getTradeQuestions: (projectId, tradeId) =>
    authFetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/questions`)),
    
  // Answers
  saveAnswers: (projectId, tradeId, answers) =>
    authFetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/answers`), {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
    
  // LV
  generateLV: (projectId, tradeId) =>
    authFetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/lv`), {
      method: 'POST',
    }),
    
  getLVs: (projectId) =>
    authFetch(apiUrl(`/api/projects/${projectId}/lv`)),
    
  exportLV: (projectId, tradeId, withPrices = true) =>
    authFetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/lv/export?withPrices=${withPrices}`)),
    
  // Cost Summary
  getCostSummary: (projectId) =>
    authFetch(apiUrl(`/api/projects/${projectId}/cost-summary`)),
    
  // Trades
  getTrades: () =>
    authFetch(apiUrl('/api/trades')),
    
  // Admin
  adminLogin: (username, password) =>
    authFetch(apiUrl('/api/admin/login'), {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
    
  getAdminProjects: () =>
    authFetch(apiUrl('/api/admin/projects')),
    
  updatePrompt: (id, content) =>
    authFetch(apiUrl(`/api/admin/prompts/${id}`), {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
};

export default api;
