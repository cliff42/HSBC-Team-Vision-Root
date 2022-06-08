import { createSlice } from "@reduxjs/toolkit";
import { User } from "./usersSlice";

const favouritesSlice = createSlice({
  name: "favourites",
  initialState: { favouritesList: [] as User[] },
  reducers: {
    setFavourites: (state, action) => {
      state.favouritesList = action.payload;
    },
    clearFavourites: (state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      state.favouritesList = [];
    },
  },
});

export const { setFavourites, clearFavourites } = favouritesSlice.actions;

export default favouritesSlice.reducer;
