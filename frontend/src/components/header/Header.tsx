import { useState } from "react";
import { Typography } from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import EditCollectionModal from "../modals/EditCollectionModal";
import { User } from "../../reducers/usersSlice";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { NewMeetingData } from "../cards/NewMeetingCard";
import React from "react";
import SearchBar, { SearchBarProps } from "./SearchBar";
import Dropdown, { DropdownProps } from "./Dropdown";
interface UpdateFavouritesData {
  action: string;
  favourites: string[];
}
interface HeaderProps {
  title: string;
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
  sortProps?: DropdownProps;
  filterProps?: DropdownProps;
  searchProps?: SearchBarProps;
  showSort: boolean;
  showFilter: boolean;
  showSearchBar: boolean;
}

const Header = ({
  title,
  socket,
  connected,
  sortProps,
  filterProps,
  searchProps,
  showSort,
  showFilter,
  showSearchBar,
}: HeaderProps) => {
  const favourites = useSelector((state: RootState) => state.favourites.favouritesList);
  const [openFavouritesModal, setOpenFavouritesModal] = useState(false);

  const updateFavourites = (employees: User[]) => {
    if (connected && favourites !== employees) {
      const dataToSend: UpdateFavouritesData = {
        action: "updateFavourites",
        favourites: employees.map((employee) => employee.UserID),
      };
      console.log("updating favourites", dataToSend);

      socket.current?.send(JSON.stringify(dataToSend));
    }
  };

  const callFavourites = (employees: User[], name: string) => {
    if (!connected) return;

    const dataToSend: NewMeetingData = {
      action: "createMeeting",
      body: {
        topic: name,
        members: employees.map((employee) => employee.UserID),
        waitingRoom: true,
      },
    };
    console.log("calling all favourites", dataToSend);

    socket.current?.send(JSON.stringify(dataToSend));
  };

  const onCloseFavouritesModal = (employees: User[]) => {
    // Can decide whether to setFavourites directly here too, if the endpoint is slow with more favourites
    updateFavourites(employees);
    setOpenFavouritesModal(false);
  };

  const onOpenFavouritesModal = () => {
    setOpenFavouritesModal(true);
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        paddingBottom: 50,
      }}
    >
      <Typography variant="h2">{title}</Typography>

      <div style={{ display: "flex", alignItems: "center" }}>
        {showSort && sortProps !== undefined && <Dropdown {...sortProps}></Dropdown>}
        {showFilter && filterProps !== undefined && <Dropdown {...filterProps}></Dropdown>}
        {showSearchBar && searchProps !== undefined && <SearchBar {...searchProps}></SearchBar>}
        <StarIcon
          sx={{ padding: "10px", color: "gold", cursor: "pointer" }}
          onClick={onOpenFavouritesModal}
        ></StarIcon>
      </div>

      <EditCollectionModal
        open={openFavouritesModal}
        onClose={onCloseFavouritesModal}
        title="Favourites"
        subtitle1="All Employees"
        subtitle2="Your Favourites"
        submitHandler={callFavourites}
        submitButtonText="Call All Favourites"
        existingCollection={favourites}
        isGroup={false}
        socket={socket}
        connected={connected}
      />
    </div>
  );
};

export default Header;
