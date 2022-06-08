import { createSlice } from "@reduxjs/toolkit";

// KEEP EXAMPLE OF ASYNC THUNK
// // Async thunks return the payload to be dispatched for a given action
// export const loginUser = createAsyncThunk(
//   "user/loginUser",
//   async ({ email, password }: Credentials, thunkAPI) => {
//     try {
//       const user = await login(email, password);
//       // window.localStorage.setItem("currentHSBCuser", JSON.stringify(user));
//       console.log("Successfully logged in!", user);
//       return user.user.refreshToken;
//     } catch (e) {
//       thunkAPI.dispatch(setNotification("Incorrect email or password."));
//       return null;
//     }
//   }
// );

const userSlice = createSlice({
  name: "user",
  // Always set initial state to an object with your initial state
  initialState: { userToken: "" as string | null },
  // Non async action creators are generated automatically, the "reducers" and "extra reducers" take the place of case reducers
  reducers: {
    setUser: (state, action) => {
      state.userToken = action.payload;
    },
    clearUser: (state) => {
      state.userToken = null;
    },
  },
  // KEEP EXAMPLE OF EXTRA THUNK REDUCER
  // extraReducers: (builder) => {
  //   builder.addCase(loginUser.fulfilled, (state, action) => {
  //     state.userToken = action.payload;
  //   });
  // },
});

export const { setUser, clearUser } = userSlice.actions;

export default userSlice.reducer;
