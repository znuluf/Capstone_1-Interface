using System.ComponentModel.DataAnnotations;

namespace Capstone.Validation;

/// <summary>
/// An email address that may be left blank. [EmailAddress] alone rejects an empty string, which
/// the Angular forms send for an untouched optional field; when a value is present it must still
/// be a valid address.
/// </summary>
public sealed class OptionalEmailAddressAttribute : ValidationAttribute
{
    private static readonly EmailAddressAttribute EmailCheck = new EmailAddressAttribute();

    public OptionalEmailAddressAttribute()
        : base("The {0} field is not a valid e-mail address.")
    {
    }

    public override bool IsValid(object value)
    {
        if (value == null)
        {
            return true;
        }

        var text = value as string;
        if (text == null)
        {
            return false;
        }

        return string.IsNullOrWhiteSpace(text) || EmailCheck.IsValid(text.Trim());
    }
}
