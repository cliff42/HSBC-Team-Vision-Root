import React, { useState, useCallback, useEffect } from "react";
import Header from "../components/header/Header";
import { Container, Grid, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import Tooltip, { TooltipProps, tooltipClasses } from "@mui/material/Tooltip";
import GroupCard from "../components/cards/GroupCard";
import NewGroupCard from "../components/cards/NewGroupCard";
import { User } from "../reducers/usersSlice";
import { SearchBarProps } from "../components/header/SearchBar";
import { DropdownProps } from "../components/header/Dropdown";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";

enum FILTERS {
  FAVOURITES = "Favourites",
}

enum SORTS {
  ALPHA = "Alphabetical",
  ALPHA_REV = "Alphabetical (reverse)",
}

export interface GroupInfo {
  GroupID: string;
  description: string;
  title: string;
  members: Array<User>;
}

interface GroupsProps {
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
}

const CustomWidthTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: 480,
  },
});

export default function Groups({ socket, connected }: GroupsProps) {
  const [groups, setGroups] = useState<GroupInfo[] | null>([]);
  const [sortValue, setSortValue] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [searchString, setSearchString] = useState("");

  const onSocketMessage = useCallback((dataStr) => {
    const data = JSON.parse(dataStr.data);
    if (data.groups) {
      console.log(data);
      setGroups(data.groups);
    }
  }, []);

  useEffect(() => {
    if (connected) {
      socket.current?.addEventListener("message", onSocketMessage, false);
      socket.current?.send(JSON.stringify({ action: "getGroups" }));
    }
    return () => {
      socket.current?.removeEventListener("message", onSocketMessage, false);
    };
  }, [connected]);

  const applySearch = (unsearchedGroups: GroupInfo[] | null, searchString: string): GroupInfo[] | null => {
    // loop through array of groups and filter out those that don't
    // contains the substring in either their description, title, or members

    // check if ongoing calls are null first
    if (unsearchedGroups && searchString !== "" && searchString !== null) {
      const filtered = unsearchedGroups?.filter(
        (group) =>
          group.title.toLowerCase().includes(searchString.toLowerCase()) ||
          group.description.toLowerCase().includes(searchString.toLowerCase()) ||
          group.members.some(
            (member) =>
              member.name.toLowerCase().includes(searchString.toLowerCase()) ||
              member.UserID.toLowerCase().includes(searchString.toLowerCase())
          )
      );

      return filtered;
    } else {
      return unsearchedGroups;
    }
  };

  const applyFilter = (unfilteredGroups: GroupInfo[] | null, filter: string): GroupInfo[] | null => {
    const favourites = useSelector((state: RootState) => state.favourites.favouritesList);
    if (unfilteredGroups && filter !== "" && filter !== null) {
      switch (filter) {
        case FILTERS.FAVOURITES: {
          const filtered = unfilteredGroups?.filter((group) =>
            group.members.some((member) => favourites.some((favorite) => favorite.UserID === member.UserID))
          );
          return filtered;
        }
        default: {
          return unfilteredGroups;
        }
      }
    } else {
      return unfilteredGroups;
    }
  };

  const applySort = (unsortedGroups: GroupInfo[] | null, sort: string): GroupInfo[] | null => {
    if (unsortedGroups && sort !== null) {
      switch (sort) {
        case SORTS.ALPHA: {
          return [...unsortedGroups].sort((a, b) => a.title.localeCompare(b.title));
        }
        case SORTS.ALPHA_REV: {
          return [...unsortedGroups].sort((a, b) => a.title.localeCompare(b.title)).reverse();
        }
        default: {
          // default to alphabetical
          return [...unsortedGroups].sort((a, b) => a.title.localeCompare(b.title));
        }
      }
    } else {
      return unsortedGroups;
    }
  };

  const organizeGroups = (): GroupInfo[] | null => {
    // sort, filter, then apply search in that order
    const sorted = applySort(groups, sortValue);
    const filtered = applyFilter(sorted, filterValue);
    const searched = applySearch(filtered, searchString);
    return searched;
  };

  const searchOptions = (): Set<string> => {
    // create a dictionary of all the searchable strings in the array of groups
    const searchDict = new Set<string>();

    if (groups) {
      for (const group of groups) {
        searchDict.add(group.title);
        group.members.forEach((member) => searchDict.add(member.name));
      }
    }

    return searchDict;
  };

  const sortProps: DropdownProps = {
    title: "Sort",
    options: Object.values(SORTS),
    callBack: setSortValue,
  };

  const filterProps: DropdownProps = {
    title: "Filter",
    options: Object.values(FILTERS),
    callBack: setFilterValue,
  };

  const searchBarProps: SearchBarProps = {
    searchDict: searchOptions(),
    searchHandler: setSearchString,
    reactiveSearch: true,
    searchPlaceholder: "Search by group or name",
  };

  const organizedGroups = organizeGroups();
  return (
    <Container sx={{ width: "100%" }} maxWidth={false}>
      <Header
        title="Groups"
        socket={socket}
        connected={connected}
        sortProps={sortProps}
        filterProps={filterProps}
        searchProps={searchBarProps}
        showSort={true}
        showFilter={true}
        showSearchBar={true}
      />
      <Grid container spacing={10} columns={24} sx={{ paddingTop: 2 }}>
        <Grid item sm={24} md={12} lg={8} xl={6}>
          <NewGroupCard socket={socket} connected={connected} />
        </Grid>
        {(Array.isArray(organizedGroups) ? organizedGroups : groups)?.map((group) => (
          <Grid item key={group.title} sm={24} md={12} lg={8} xl={6}>
            <GroupCard group={group} socket={socket} connected={connected} />
          </Grid>
        ))}
      </Grid>

      <CustomWidthTooltip
        disableFocusListener
        disableTouchListener
        placement="right"
        title="Each card represents a group. With each group you can perform 4 actions: Call, Schedule Meeting, View/Edit, and Delete. To view your favourites list, click on the gold star in the top right of the screen."
      >
        <IconButton sx={{ position: "fixed", bottom: 10, left: 310 }}>
          <QuestionMarkIcon sx={{ color: "grey" }} />
        </IconButton>
      </CustomWidthTooltip>
    </Container>
  );
}
