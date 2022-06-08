import { createSlice } from "@reduxjs/toolkit";

export interface User {
  UserID: string;
  name: string;
}

const usersSlice = createSlice({
  name: "users",
  initialState: { usersList: [] as User[] },
  reducers: {
    setUsers: (state, action) => {
      state.usersList = action.payload;
    },
    clearUsers: (state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      state.usersList = [];
    },
  },
});

export const { setUsers, clearUsers } = usersSlice.actions;

export default usersSlice.reducer;
