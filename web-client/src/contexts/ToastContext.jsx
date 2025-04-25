import React from 'react';
import { toast } from 'react-toastify';

// Обертка для совместимости со старым кодом
export const useToast = () => {
  return {
    success: toast.success,
    error: toast.error,
    info: toast.info,
    warning: toast.warning
  };
};

export default { useToast }; 