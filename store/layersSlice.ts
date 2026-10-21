import { createSlice } from '@reduxjs/toolkit';

export interface Layer {
  id: string;
  images: string[];
  visibility: boolean;
}

export interface LayersState {
  layers: Record<Layer['id'], Layer>;
  showShadows: boolean;
}

const initialState : LayersState = {
  layers: {},
  showShadows: false
};

export const layersSlice = createSlice({
  name: 'layers',
  initialState,
  reducers: {
    setLayers: (state, payload) => {
      state.layers = payload.payload;
    },
    setLayerVisibility: (state, payload) => {
      console.log(payload.payload);
      
      const {layerID, visibility} = payload.payload;
      state.layers[layerID].visibility = visibility;
    },
    setShowShadows: (state, payload) => {
      state.showShadows = payload.payload;
    },
    // setHover: (i_hoverL ``) => {}
  },
});

export const { setLayers, setLayerVisibility, setShowShadows } = layersSlice.actions;
export default layersSlice.reducer;
