import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

let timeoutID: NodeJS.Timeout;

export const setNotification = createAsyncThunk(
  "user/setNotification",
  async (message: string, thunkAPI) => {
    if (timeoutID != undefined) clearTimeout(timeoutID);
    timeoutID = setTimeout(() => thunkAPI.dispatch(clearNotification()), 5000);
    return message;
  }
);

const notificationSlice = createSlice({
  name: "notification",
  initialState: { message: "" as string | null },
  reducers: {
    clearNotification: (state) => {
      state.message = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(setNotification.fulfilled, (state, action) => {
      state.message = action.payload;
    });
  },
});

export const { clearNotification } = notificationSlice.actions;

export default notificationSlice.reducer;
