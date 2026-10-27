namespace Capstone.Models.TokenAuth
{
    public class AuthenticateResultModel
    {
        public string AccessToken { get; set; }

        public string EncryptedAccessToken { get; set; }

        public int ExpireInSeconds { get; set; }

        public long UserId { get; set; }

        /// <summary>True for new or reset accounts: the client must show the change-password screen.</summary>
        public bool ShouldChangePassword { get; set; }
    }
}
