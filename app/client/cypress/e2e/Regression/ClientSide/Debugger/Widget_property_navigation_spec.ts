import * as _ from "../../../../support/Objects/ObjectsCore";

describe("Widget property navigation", () => {
  it("Collapsed field navigation", () => {
    _.entityExplorer.DragDropWidgetNVerify(_.draggableWidgets.AUDIO, 100, 200);
    _.propPane.EnterJSContext("animateloading", "{{test}}", true, false);
    _.debuggerHelper.AssertErrorCount(1);
    _.propPane.ToggleSection("general");
    _.propPane.AssertIfPropertyIsNotVisible("animateloading");
    _.debuggerHelper.ClickDebuggerIcon();
    _.debuggerHelper.ClicklogEntityLink();
    _.propPane.AssertIfPropertyIsVisible("animateloading");

    _.propPane.DeleteWidgetFromPropertyPane("Audio1");
    _.debuggerHelper.CloseBottomBar();
  });
  it("Navigation to a nested panel", () => {
    _.entityExplorer.DragDropWidgetNVerify(_.draggableWidgets.TAB, 100, 200);
    _.propPane.OpenTableColumnSettings("tab2");
    _.propPane.EnterJSContext("visible", "{{test}}", true, false);
    _.debuggerHelper.AssertErrorCount(1);
    _.propPane.NavigateBackToPropertyPane();
    _.debuggerHelper.ClickDebuggerIcon();
    _.debuggerHelper.ClicklogEntityLink();
    _.agHelper.GetElement(_.propPane._paneTitle).contains("Tab 2");
    _.propPane.AssertIfPropertyIsVisible("visible");

    _.debuggerHelper.CloseBottomBar();
    _.entityExplorer.SelectEntityByName("Tabs1");
    _.entityExplorer.DeleteWidgetFromEntityExplorer("Tabs1");
  });
  it("Navigation to style tab in a nested panel", () => {
    _.entityExplorer.DragDropWidgetNVerify(
      _.draggableWidgets.BUTTON_GROUP,
      100,
      200,
    );
    _.propPane.OpenTableColumnSettings("groupButton2");
    _.agHelper.GetNClick(_.propPane._segmentedControl("MENU"));
    _.agHelper.GetNClick(_.propPane._addMenuItem);
    _.agHelper.GetNClick(_.propPane._tableEditColumnButton);
    _.propPane.MoveToTab("Style");
    _.propPane.EnterJSContext("icon", "{{test}}", true, false);
    _.debuggerHelper.AssertErrorCount(1);
    _.propPane.NavigateBackToPropertyPane(false);
    _.propPane.NavigateBackToPropertyPane();
    _.debuggerHelper.ClickDebuggerIcon();
    _.debuggerHelper.ClicklogEntityLink();
    _.agHelper.GetElement(_.propPane._paneTitle).contains("Menu Item 1");
    _.propPane.AssertIfPropertyIsVisible("icon");

    _.debuggerHelper.CloseBottomBar();
    _.entityExplorer.SelectEntityByName("ButtonGroup1");
    _.entityExplorer.DeleteWidgetFromEntityExplorer("ButtonGroup1");
  });
  it("Collapsed field navigation for a nested panel", () => {
    _.entityExplorer.DragDropWidgetNVerify(
      _.draggableWidgets.MENUBUTTON,
      100,
      200,
    );
    _.propPane.OpenTableColumnSettings("menuItem2");
    _.propPane.EnterJSContext("disabled", "{{test}}", true, false);
    _.propPane.ToggleSection("general");
    _.propPane.MoveToTab("Style");
    _.debuggerHelper.AssertErrorCount(1);
    _.propPane.NavigateBackToPropertyPane();
    _.debuggerHelper.ClickDebuggerIcon();
    _.debuggerHelper.ClicklogEntityLink();
    _.agHelper.GetElement(_.propPane._paneTitle).contains("Second Menu Item");
    _.propPane.AssertIfPropertyIsVisible("disabled");

    _.debuggerHelper.CloseBottomBar();
    _.entityExplorer.SelectEntityByName("MenuButton1");
    _.entityExplorer.DeleteWidgetFromEntityExplorer("MenuButton1");
  });

  it("JSONForm widget error navigation", () => {
    _.entityExplorer.DragDropWidgetNVerify(
      _.draggableWidgets.JSONFORM,
      100,
      200,
    );
    _.propPane.OpenTableColumnSettings("date_of_birth");

    _.agHelper.SelectDropdownList("Field Type", "Object");
    _.agHelper.GetNClick(_.propPane._addColumnItem);
    _.agHelper.GetNClick(_.propPane._addColumnItem);
    _.propPane.OpenTableColumnSettings("customField1");

    _.agHelper.SelectDropdownList("Field Type", "Object");
    _.agHelper.GetNClick(_.propPane._addColumnItem);
    _.agHelper.GetNClick(_.propPane._addColumnItem);
    _.propPane.OpenTableColumnSettings("customField2");

    _.propPane.MoveToTab("Style");

    _.propPane.EnterJSContext("borderradius", "{{test}}", true, false);
    _.debuggerHelper.AssertErrorCount(1);
    _.propPane.ToggleSection("borderandshadow");
    _.propPane.MoveToTab("Content");

    _.propPane.NavigateBackToPropertyPane(false);
    _.propPane.NavigateBackToPropertyPane(false);
    _.propPane.NavigateBackToPropertyPane();

    _.debuggerHelper.ClickDebuggerIcon();
    _.debuggerHelper.ClicklogEntityLink();
    _.agHelper.GetElement(_.propPane._paneTitle).contains("Custom Field 2");
    _.propPane.AssertIfPropertyIsVisible("borderradius");

    _.debuggerHelper.CloseBottomBar();
    _.entityExplorer.SelectEntityByName("JSONForm1");
    _.entityExplorer.DeleteWidgetFromEntityExplorer("JSONForm1");
  });
});