import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./reducers/userSlice";
import notificationReducer from "./reducers/notificationSlice";
import usersReducer from "./reducers/usersSlice";
import favouritesReducer from "./reducers/favouritesSlice";

// Automatically combines reducers and adds redux-thunk
const store = configureStore({
  reducer: {
    user: userReducer,
    users: usersReducer,
    notification: notificationReducer,
    favourites: favouritesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export default store;
