import { configureStore } from '@reduxjs/toolkit';
import layersReducer, { LayersState } from './layersSlice';
import appReducer, { AppState } from './appSlice';

export interface State {
  layers: LayersState;
  app: AppState;
}

export const store = configureStore({
  reducer: {
    app: appReducer,
    layers: layersReducer,
  },
});
