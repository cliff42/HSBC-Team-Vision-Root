import * as React from "react";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import { alertYellow } from "../../styles/Colors";
import { inputLabelClasses, outlinedInputClasses, styled } from "@mui/material";

const StyledFormControl = styled(FormControl)({
  [`& .${outlinedInputClasses.root} .${outlinedInputClasses.notchedOutline}`]: {
    borderColor: "black",
  },
  [`&:hover .${outlinedInputClasses.root} .${outlinedInputClasses.notchedOutline}`]: {
    borderColor: alertYellow,
  },
  [`& .${outlinedInputClasses.root}.${outlinedInputClasses.focused} .${outlinedInputClasses.notchedOutline}`]: {
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

export interface DropdownProps {
  title: string;
  options: Array<string>;
  callBack: (option: string) => void;
}

export default function Dropdown({ title, options, callBack }: DropdownProps) {
  const [value, setValue] = React.useState("");

  return (
    <Box sx={{ width: 120, padding: "10px" }}>
      <StyledFormControl className="dropdown" fullWidth>
        <InputLabel>{title}</InputLabel>
        <Select
          value={value}
          label={title}
          onChange={(event) => {
            setValue(event.target.value);
            // make call back to page
            callBack(event.target.value);
          }}>
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {options.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </StyledFormControl>
    </Box>
  );
}
