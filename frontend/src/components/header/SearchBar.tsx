import React, { useState } from "react";
import { IconButton, inputLabelClasses, outlinedInputClasses, styled } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import "../../styles/Styles.css";
import { alertYellow } from "../../styles/Colors";
import CloseIcon from "@mui/icons-material/Close";

const StyledSearchBar = styled(TextField)({
  [`& .${outlinedInputClasses.root} .${outlinedInputClasses.notchedOutline}`]: {
    borderColor: "black",
  },
  [`&:hover .${outlinedInputClasses.root} .${outlinedInputClasses.notchedOutline}`]: {
    borderColor: alertYellow,
  },
  [`& .${outlinedInputClasses.root}.${outlinedInputClasses.focused} .${outlinedInputClasses.notchedOutline}`]:
    {
      borderColor: alertYellow,
    },
  [`& .${outlinedInputClasses.input}`]: {
    color: "black",
  },
  [`&:hover .${outlinedInputClasses.input}`]: {
    color: "black",
  },
  [`& .${outlinedInputClasses.root}.${outlinedInputClasses.focused} .${outlinedInputClasses.input}`]: {
    color: "black",
  },
  [`& .${inputLabelClasses.outlined}`]: {
    color: "black",
  },
  [`&:hover .${inputLabelClasses.outlined}`]: {
    color: "black",
  },
  [`& .${inputLabelClasses.outlined}.${inputLabelClasses.focused}`]: {
    color: "black",
  },
});

export interface SearchBarProps {
  searchDict: Set<string>;
  searchHandler: (searchString: string) => void;
  reactiveSearch: boolean;
  searchPlaceholder: string;
}

export default function SearchBar({
  searchDict,
  searchHandler,
  reactiveSearch,
  searchPlaceholder,
}: SearchBarProps) {
  const [searchField, setSearchField] = useState("");

  const searchButtonHandler = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    searchHandler(searchField);
  };

  const keyDownHandler = (e: React.KeyboardEvent) => {
    const popup = document.getElementById("auto-complete-popup");
    if (e.key === "Enter" && !popup) {
      searchHandler(searchField);
    }
  };

  return (
    <div id="blur">
      <Autocomplete
        sx={{ padding: "10px" }}
        clearIcon={<CloseIcon fontSize="small" sx={{ color: "black" }}></CloseIcon>}
        disableClearable={false}
        id="auto-complete"
        options={Array.from(searchDict.values())}
        blurOnSelect="touch"
        selectOnFocus={false}
        size="small"
        style={{ width: 300 }}
        clearOnBlur={false}
        fullWidth={true}
        clearOnEscape={false}
        forcePopupIcon={false}
        inputValue={searchField}
        onInputChange={(event, value) => {
          if (value !== null) {
            const newValue = value as string;
            setSearchField(newValue);
            reactiveSearch || newValue === "" ? searchHandler(newValue) : null;
          }
        }}
        onChange={(event, value) => {
          if (value !== null) {
            const newValue = value as string;
            setSearchField(newValue);
            reactiveSearch || newValue === "" ? searchHandler(newValue) : null;
          }
        }}
        renderInput={(params) => (
          <StyledSearchBar
            {...params}
            className="searchBar"
            id="home-search-bar"
            variant="outlined"
            placeholder={searchPlaceholder}
            onKeyDown={keyDownHandler}
            InputProps={{
              ...params.InputProps,
              type: "search",
              endAdornment: (
                <IconButton aria-label="search" onClick={searchButtonHandler}>
                  <SearchIcon />
                </IconButton>
              ),
            }}
          ></StyledSearchBar>
        )}
      />
    </div>
  );
}
