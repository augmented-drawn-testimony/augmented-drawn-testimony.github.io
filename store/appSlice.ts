import { createSlice } from '@reduxjs/toolkit';

export type Language = 'en' | 'da';

export interface AppState {
    mode: 'default' | 'explore';
    selectedPainting: number;
    selectedGroup: string | null;
    language: Language;
}

const initialState: AppState = {
  mode: 'default',
  selectedPainting: 0,
  selectedGroup: null,
  language: 'en',
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setMode: (state, action) => {
      state.mode = action.payload;
    },
    setSelectedPainting: (state, action) => {
      state.selectedPainting = action.payload;
    },
    setSelectedGroup: (state, action) => {
      state.selectedGroup = action.payload;
    },
    setLanguage: (state, action) => {
      state.language = action.payload;
    }
  },
});

export const { setMode, setSelectedPainting, setSelectedGroup, setLanguage } = appSlice.actions;
export default appSlice.reducer;
