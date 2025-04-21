import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { PersistGate } from "redux-persist/integration/react";
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import store, {persistor} from './store.ts'
import { StompProvider } from './StompContext.tsx';


createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <BrowserRouter>
          <StompProvider>
            <App />
          </StompProvider>
        </BrowserRouter>
    </PersistGate>
  </Provider>
  ,
)