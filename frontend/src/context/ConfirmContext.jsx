import { createContext, useContext, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState]   = useState({ open: false, title: '', text: '' });
  const resolveRef          = useRef(null);

  const confirm = (title, text) => new Promise(resolve => {
    resolveRef.current = resolve;
    setState({ open: true, title, text });
  });

  const handle = (result) => {
    setState(s => ({ ...s, open: false }));
    resolveRef.current?.(result);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <div className={`modal-overlay${state.open ? ' open' : ''}`}>
        <div className="modal-box">
          <div className="modal-icon"><i className="fas fa-triangle-exclamation"></i></div>
          <div className="modal-title">{state.title}</div>
          <div className="modal-text">{state.text}</div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => handle(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => handle(true)}>
              <i className="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      </div>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
