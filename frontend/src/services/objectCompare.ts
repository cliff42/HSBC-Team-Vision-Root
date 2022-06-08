export const objectsEqual = (o1: unknown, o2: unknown): boolean =>
  o1 != null &&
  o2 !== null &&
  typeof o1 === "object" &&
  typeof o2 === "object" &&
  Object.keys(o1).length > 0
    ? Object.keys(o1).length === Object.keys(o2).length &&
      Object.keys(o1).every((p) =>
        objectsEqual(o1[p as keyof typeof o1], o2[p as keyof typeof o2])
      )
    : o1 === o2;

// Comparing two arrays of objects
// const favouritesUnchanged =
//   favourites.length === employees.length &&
//   favourites.every((o, idx) =>
//     objectsEqual(o as unknown, employees[idx] as unknown)
//   );
