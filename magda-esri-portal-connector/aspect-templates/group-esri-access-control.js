return {
    groups: [group.id],
    access: group.access === "any authenticated users" ? "org" : group.access
};
