function selectedFriendIds(selection, friends) {
  const allowed = new Set(friends.map(friend => friend.id));
  return [...new Set(selection)].filter(id => allowed.has(id));
}

if (typeof module !== "undefined") module.exports = { selectedFriendIds };

