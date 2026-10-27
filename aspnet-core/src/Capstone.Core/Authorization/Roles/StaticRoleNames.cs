namespace Capstone.Authorization.Roles;

public static class StaticRoleNames
{
    public static class Host
    {
        /// <summary>Host-level technical support account (decision D-16).</summary>
        public const string SystemAdministrator = "SystemAdministrator";

        /// <summary>Template name kept so older databases still resolve; not created any more.</summary>
        public const string Admin = "Admin";
    }

    public static class Tenants
    {
        public const string FarmOwner = "FarmOwner";
        public const string FarmTechnician = "FarmTechnician";
    }
}
