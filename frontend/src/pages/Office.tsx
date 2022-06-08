import React, { useState, useCallback, useEffect } from "react";
import Grid from "@mui/material/Grid";
import Container from "@mui/material/Container";
import CallCard from "../components/cards/CallCard";
import Header from "../components/header/Header";
import NewMeetingCard from "../components/cards/NewMeetingCard";
import { SearchBarProps } from "../components/header/SearchBar";
import { DropdownProps } from "../components/header/Dropdown";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import Tooltip, { TooltipProps, tooltipClasses } from "@mui/material/Tooltip";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";

enum FILTERS {
  FAVOURITES = "Favourites",
}

enum SORTS {
  ALPHA = "Alphabetical",
  ALPHA_REV = "Alphabetical (reverse)",
}

interface MeetingInfo {
  id: number;
  topic: string;
  members: Array<string>;
  url: string;
}
interface OfficeProps {
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
}

const CustomWidthTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: 370,
  },
});

export default function Office({ socket, connected }: OfficeProps) {
  const [ongoingCalls, setOngoingCalls] = useState<MeetingInfo[] | null>([]);
  const [sortValue, setSortValue] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [searchString, setSearchString] = useState("");

  const onSocketMessage = useCallback((dataStr) => {
    const data = JSON.parse(dataStr.data);

    if (data.zoomMeetings) {
      console.log(data);
      setOngoingCalls(data.zoomMeetings.meetings);
    }
  }, []);

  useEffect(() => {
    if (connected) {
      socket.current?.addEventListener("message", onSocketMessage, false);
      socket.current?.send(JSON.stringify({ action: "getActiveMeetings" }));
    }
    return () => {
      socket.current?.removeEventListener("message", onSocketMessage, false);
    };
  }, [connected]);

  const applySearch = (unsearchedCalls: MeetingInfo[] | null, searchString: string): MeetingInfo[] | null => {
    // loop through array of calls and filter out those that don't
    // contains the substring in either their topic or members

    // check if ongoing calls are null first
    if (unsearchedCalls && searchString !== "" && searchString !== null) {
      const filtered = unsearchedCalls?.filter(
        (call) =>
          call.topic.toLowerCase().includes(searchString.toLowerCase()) ||
          call.members.some((member) => member.toLowerCase().includes(searchString.toLowerCase()))
      );

      return filtered;
    } else {
      return unsearchedCalls;
    }
  };

  const applyFilter = (unfilteredCalls: MeetingInfo[] | null, filter: string): MeetingInfo[] | null => {
    const favourites = useSelector((state: RootState) => state.favourites.favouritesList);
    if (unfilteredCalls && filter !== "" && filter !== null) {
      switch (filter) {
        case FILTERS.FAVOURITES: {
          const filtered = unfilteredCalls?.filter((call) =>
            call.members.some((member) =>
              favourites.some((favorite) => favorite.name.toLowerCase() === member.toLowerCase())
            )
          );
          return filtered;
        }
        default: {
          return unfilteredCalls;
        }
      }
    } else {
      return unfilteredCalls;
    }
  };

  const applySort = (unsortedCalls: MeetingInfo[] | null, sort: string): MeetingInfo[] | null => {
    if (unsortedCalls && sort !== null) {
      switch (sort) {
        case SORTS.ALPHA: {
          return [...unsortedCalls].sort((a, b) => a.topic.localeCompare(b.topic));
        }
        case SORTS.ALPHA_REV: {
          return [...unsortedCalls].sort((a, b) => a.topic.localeCompare(b.topic)).reverse();
        }
        default: {
          // default to alphabetical
          return [...unsortedCalls].sort((a, b) => a.topic.localeCompare(b.topic));
        }
      }
    } else {
      return unsortedCalls;
    }
  };

  const organizeCalls = (): MeetingInfo[] | null => {
    // sort, filter, then apply search in that order
    const sorted = applySort(ongoingCalls, sortValue);
    const filtered = applyFilter(sorted, filterValue);
    const searched = applySearch(filtered, searchString);
    return searched;
  };

  const searchOptions = (): Set<string> => {
    // create a dictionary of all the searchable strings in the array of calls
    const searchDict = new Set<string>();

    if (ongoingCalls) {
      for (const meeting of ongoingCalls) {
        searchDict.add(meeting.topic);
        meeting.members.forEach((member) => searchDict.add(member));
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
    searchPlaceholder: "Search by meeting or name",
  };

  const organizedCalls = organizeCalls();
  return (
    <>
      <Container sx={{ width: "100%" }} maxWidth={false}>
        <Header
          title="Office"
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
            <NewMeetingCard socket={socket} connected={connected} />
          </Grid>
          {(Array.isArray(organizedCalls) ? organizedCalls : ongoingCalls)?.map((call) => (
            <Grid item key={call.id} sm={24} md={12} lg={8} xl={6}>
              <CallCard title={call.topic} members={call.members} link={call.url}></CallCard>
            </Grid>
          ))}
        </Grid>

        <CustomWidthTooltip
          disableFocusListener
          disableTouchListener
          placement="right"
          title="Each card represents a meeting. Click on the green arrow on a meeting to join it. You won't be able to see meetings created by employees who outrank you."
        >
          <IconButton sx={{ position: "fixed", bottom: 10, left: 310 }}>
            <QuestionMarkIcon sx={{ color: "grey" }} />
          </IconButton>
        </CustomWidthTooltip>
      </Container>
    </>
  );
}
