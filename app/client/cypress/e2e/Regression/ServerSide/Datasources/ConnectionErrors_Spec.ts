import {
  agHelper,
  dataSources,
  locators,
  propPane,
  tedTestConfig,
} from "../../../../support/Objects/ObjectsCore";

describe("Validate Empty DS error messages", () => {
  let dataSourceName: string;

  afterEach("Delete DS", () => {
    dataSources.DeleteDSDirectly(200, false);
  });

  it("1. Postgress connection errors", () => {
    dataSources.NavigateToDSCreateNew();
    agHelper.GenerateUUID();
    cy.get("@guid").then((uid) => {
      dataSources.CreatePlugIn("PostgreSQL");
      dataSourceName = "PostgreSQL" + " " + uid;
      agHelper.RenameWithInPane(dataSourceName, false);

      dataSources.TestDatasource(false);
      agHelper.ValidateToastMessage("Missing endpoint.");
      agHelper.ValidateToastMessage("Missing username for authentication.", 1);
      agHelper.ClearTextField(dataSources._databaseName);
      dataSources.TestDatasource(false);
      agHelper.ValidateToastMessage("Missing database name.", 2);
      agHelper.WaitUntilAllToastsDisappear();
      agHelper.UpdateInputValue(
        dataSources._host,
        tedTestConfig.dsValues[tedTestConfig.defaultEnviorment].postgres_host,
      );
      agHelper.UpdateInputValue(
        dataSources._databaseName,
        tedTestConfig.dsValues[tedTestConfig.defaultEnviorment]
          .postgres_databaseName,
      );
      agHelper.UpdateInputValue(
        dataSources._username,
        tedTestConfig.dsValues[tedTestConfig.defaultEnviorment]
          .postgres_username,
      );
      dataSources.TestDatasource(false);
      agHelper.ValidateToastMessage(
        "An exception occurred while creating connection pool. One or more arguments in the datasource configuration may be invalid.",
      );
      agHelper.ValidateToastMessage(
        "Failed to initialize pool: The server requested password-based authentication, but no password was provided by plugin null",
        1,
      );
      agHelper.GetNClick(locators._visibleTextSpan("Read only"));
      propPane.AssertPropertiesDropDownValues("SSL mode", [
        "Default",
        "Allow",
        "Prefer",
        "Require",
        "Disable",
      ]);
      dataSources.ValidateNSelectDropdown("SSL mode", "Default", "Disable");
      agHelper.UpdateInputValue(
        dataSources._password,
        tedTestConfig.dsValues[tedTestConfig.defaultEnviorment]
          .postgres_password,
      );
      dataSources.TestSaveDatasource();
      dataSources.AssertDataSourceInfo([
        "READ_ONLY",
        "host.docker.internal",
        "fakeapi",
      ]);
    });
  });

  it("2. MySQL connection errors", () => {
    dataSources.NavigateToDSCreateNew();
    agHelper.GenerateUUID();
    cy.get("@guid").then((uid) => {
      dataSources.CreatePlugIn("MySQL");
      dataSourceName = "MySQL" + " " + uid;
      agHelper.RenameWithInPane(dataSourceName, false);

      dataSources.TestDatasource(false);
      agHelper.ValidateToastMessage("Missing endpoint and url");
      agHelper.ValidateToastMessage("Missing username for authentication.");
      agHelper.ValidateToastMessage("Missing password for authentication.");
      agHelper.ClearTextField(dataSources._databaseName);
      dataSources.TestDatasource(false);
      agHelper.ValidateToastMessage("Missing database name.");
      agHelper.WaitUntilAllToastsDisappear();
      agHelper.UpdateInputValue(
        dataSources._host,
        tedTestConfig.dsValues[tedTestConfig.defaultEnviorment].mysql_host,
      );
      agHelper.UpdateInputValue(
        dataSources._databaseName,
        tedTestConfig.dsValues[tedTestConfig.defaultEnviorment]
          .mysql_databaseName,
      );
      agHelper.UpdateInputValue(
        dataSources._username,
        tedTestConfig.dsValues[tedTestConfig.defaultEnviorment].mysql_username,
      );
      dataSources.TestDatasource(false);
      agHelper.ValidateToastMessage(
        "Access denied for user 'root'@'172.17.0.1'",
      );
      agHelper.GetNClick(locators._visibleTextSpan("Read only"));
      propPane.AssertPropertiesDropDownValues("SSL mode", [
        "Default",
        "Required",
        "Disabled",
      ]);
      dataSources.ValidateNSelectDropdown("SSL mode", "Default", "Required");
      agHelper.UpdateInputValue(
        dataSources._password,
        tedTestConfig.dsValues[tedTestConfig.defaultEnviorment].mysql_password,
      );
      dataSources.TestDatasource(false);
      agHelper.ValidateToastMessage(
        "Trying to connect with ssl, but ssl not enabled in the server",
      );
      dataSources.ValidateNSelectDropdown("SSL mode", "Required", "Disabled");
      dataSources.TestSaveDatasource();
      dataSources.AssertDataSourceInfo([
        "READ_ONLY",
        "host.docker.internal",
        "fakeapi",
      ]);
    });
  });

  it("3. Mongo connection errors", () => {
    dataSources.NavigateToDSCreateNew();
    agHelper.GenerateUUID();
    cy.get("@guid").then((uid) => {
      dataSources.CreatePlugIn("MongoDB");
      dataSourceName = "MongoDB" + " " + uid;
      agHelper.RenameWithInPane(dataSourceName, false);

      dataSources.TestDatasource(false);
      agHelper.ValidateToastMessage("Missing endpoint(s)");
      dataSources.ValidateNSelectDropdown(
        "Use mongo connection string URI",
        "No",
        "Yes",
      );
      dataSources.TestDatasource(false);
      agHelper.ValidateToastMessage(
        "'Mongo Connection string URI' field is empty. Please edit the 'Mongo Connection URI' field to provide a connection uri to connect with.",
      );
      agHelper.UpdateInputValue(
        locators._inputFieldByName("Connection string URI") + "//input",
        tedTestConfig.mongo_uri(tedTestConfig.defaultEnviorment),
      );
      dataSources.TestDatasource();
      dataSources.ValidateNSelectDropdown(
        "Use mongo connection string URI",
        "Yes",
        "No",
      );
      agHelper.GetNClick(locators._visibleTextSpan("Read only"));
      propPane.AssertPropertiesDropDownValues("Connection type", [
        "Direct connection",
        "Replica set",
      ]);
      dataSources.ValidateNSelectDropdown(
        "Connection type",
        "Direct connection",
        "Replica set",
      );
      dataSources.TestDatasource(false);
      agHelper.ValidateToastMessage("Missing endpoint(s)");
      agHelper.UpdateInputValue(
        dataSources._host,
        tedTestConfig.dsValues[tedTestConfig.defaultEnviorment].mongo_host,
      );
      agHelper.UpdateInputValue(
        dataSources._port,
        tedTestConfig.dsValues[
          tedTestConfig.defaultEnviorment
        ].mongo_port.toString(),
      );
      dataSources.TestDatasource(false);
      agHelper.ValidateToastMessage(
        "REPLICA_SET connections should not be given a port. If you are trying to specify all the shards, please add more than one.",
      );
      propPane.AssertPropertiesDropDownValues("Authentication type", [
        "SCRAM-SHA-1",
        "SCRAM-SHA-256",
        "MONGODB-CR",
      ]);
      agHelper.ClearTextField(dataSources._databaseName);
      dataSources.TestDatasource(false);
      agHelper.ValidateToastMessage(
        "Authentication database name is invalid, no database found with this name.",
      );
      dataSources.ValidateNSelectDropdown(
        "Connection type",
        "Replica set",
        "Direct connection",
      );
      agHelper.ClearNType(
        dataSources._databaseName,
        tedTestConfig.dsValues[tedTestConfig.defaultEnviorment]
          .mongo_databaseName,
      );
      dataSources.ValidateNSelectDropdown(
        "Authentication type",
        "SCRAM-SHA-1",
        "MONGODB-CR",
      );
      propPane.AssertPropertiesDropDownValues("SSL mode", [
        "Default",
        "Enabled",
        "Disabled",
      ]);
      dataSources.ValidateNSelectDropdown("SSL mode", "Default", "Disabled");
      dataSources.TestSaveDatasource();
      dataSources.AssertDataSourceInfo([
        "No",
        "READ_ONLY",
        "Direct connection",
        "host.docker.internal",
        "28017",
      ]);
    });
  });
});
