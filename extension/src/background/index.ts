chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open_side_panel") {
    await chrome.sidePanel.open({
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    });
  }
});
