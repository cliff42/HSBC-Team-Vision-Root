/* eslint-disable react/jsx-key */
import React, { ReactChildren, ReactChild } from "react";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import DateRangeOutlinedIcon from "@mui/icons-material/DateRangeOutlined";
import AccountBoxIcon from "@mui/icons-material/AccountBox";
import Typography from "@mui/material/Typography";
import hsbc_logo from "../images/hsbc_logo.png";
import Box from "@mui/material/Box";
import { Link } from "react-router-dom";
import { logout } from "../services/firebase";
import LogoutIcon from "@mui/icons-material/Logout";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { font } from "../styles/Font";
import { IconButton } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { useDispatch } from "react-redux";
import { clearNotification } from "../reducers/notificationSlice";

const drawerWidth = 300;
const pageSideBorderPadding = 50;
const pageTopBorderPadding = 25;
const menuListItemHeight = 100;

const navTheme = createTheme({
  palette: {
    primary: {
      main: "#ffffff",
    },
    secondary: {
      main: "#fcd766",
      dark: "#debd52",
    },
    success: {
      main: "#23c272",
    },
    background: {
      default: "#d72b2d",
      paper: "#d72b2d",
    },
    text: {
      primary: "#ffffff",
      secondary: "#ffffff",
    },
  },
  typography: {
    fontFamily: font,
    fontWeightLight: 100,
    fontWeightRegular: 300,
    fontWeightBold: 700,
    h2: {
      fontWeight: 900,
      letterSpacing: 5,
    },
  },
});

const pagesTheme = createTheme({
  palette: {
    background: {
      default: "#ffffff",
      paper: "#ffffff",
    },
    text: {
      primary: "#000000",
      secondary: "#000000",
    },
  },
  typography: {
    fontFamily: font,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightBold: 900,
    h2: {
      fontWeight: 900,
      letterSpacing: 5,
    },
    h5: {
      fontWeight: 900,
    },
    h4: {
      fontWeight: 900,
      letterSpacing: 3,
    },
  },
});

interface LayoutProps {
  children: ReactChild | ReactChildren;
}

export default function Layout({ children }: LayoutProps) {
  const dispatch = useDispatch();

  // array to add components
  const listItems = [
    {
      text: "OFFICE",
      icon: <ApartmentOutlinedIcon sx={{ color: "white" }} />,
      path: "/",
    },
    {
      text: "GROUPS",
      icon: <GroupsOutlinedIcon sx={{ color: "white" }} />,
      path: "/groups",
    },
    {
      text: "CALENDAR",
      icon: <DateRangeOutlinedIcon sx={{ color: "white" }} />,
      path: "/calendar",
    },
    {
      text: "PROFILE",
      icon: <AccountBoxIcon sx={{ color: "white" }} />,
      path: "/profile",
    },
  ];

  return (
    <ThemeProvider theme={navTheme}>
      <div
        style={{
          display: "flex",
          justifyContent: "left",
          alignItems: "left",
          paddingLeft: pageSideBorderPadding,
          paddingRight: pageSideBorderPadding,
          paddingTop: pageTopBorderPadding,
          paddingBottom: pageTopBorderPadding,
        }}
      >
        <Drawer
          sx={{
            width: drawerWidth,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              minWidth: drawerWidth,
              border: 0,
              boxShadow: "2px 0 5px -2px #888",
            },
          }}
          variant="permanent"
          anchor="left"
        >
          <div
            style={{
              paddingBottom: 20,
              backgroundColor: "white",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Box
                component="img"
                sx={{
                  height: 125,
                  width: 125,
                }}
                src={hsbc_logo}
              />
              <Typography variant="h4" sx={{ paddingLeft: 1, fontWeight: 900, color: "black" }}>
                HSBC
              </Typography>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  justifyContent: "center",
                  alignItems: "center",
                  fontWeight: "fontWeightBold",
                  letterSpacing: 6,
                  color: "black",
                }}
              >
                TEAM VISION
              </Typography>
            </div>
          </div>

          <List sx={{ paddingTop: 0 }}>
            {listItems.map((item) => (
              <ListItem
                key={item.text}
                disablePadding
                sx={{
                  "&.MuiListItem-root:hover": {
                    backgroundColor: "#b12325",
                  },
                  height: menuListItemHeight,
                  paddingLeft: 2,
                }}
              >
                <ListItemButton
                  component={Link}
                  to={item.path}
                  style={{
                    textDecoration: "none",
                    color: "white",
                    height: "100%",
                  }}
                  onClick={() => dispatch(clearNotification())}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} sx={{ letterSpacing: 6 }} />
                </ListItemButton>
              </ListItem>
            ))}

            <ListItem
              disablePadding
              sx={{
                "&.MuiListItem-root:hover": {
                  backgroundColor: "#b12325",
                },
                height: menuListItemHeight,
                paddingLeft: 2,
              }}
            >
              <ListItemButton
                component="button"
                onClick={logout}
                style={{
                  textDecoration: "none",
                  color: "white",
                  height: "100%",
                }}
              >
                <ListItemIcon>
                  <LogoutIcon sx={{ color: "white" }} />
                </ListItemIcon>
                <ListItemText primary={"LOG OUT"} sx={{ letterSpacing: 6 }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Drawer>
        <ThemeProvider theme={pagesTheme}>
          <div style={{ width: "100%" }}>{children}</div>
        </ThemeProvider>
      </div>

      <IconButton component={Link} to={"/admin"} sx={{ position: "fixed", bottom: 10, right: 10 }}>
        <SettingsIcon sx={{ color: "grey" }} />
      </IconButton>
    </ThemeProvider>
  );
}
