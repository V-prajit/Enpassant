const isDevelopment = import.meta.env.VITE_APP_ENV === 'development';

export const devLog = (...args) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

export const devWarn = (...args) => {
  if (isDevelopment) {
    console.warn(...args);
  }
};

export const devError = (...args) => {
  if (isDevelopment) {
    console.error(...args);
  }
};