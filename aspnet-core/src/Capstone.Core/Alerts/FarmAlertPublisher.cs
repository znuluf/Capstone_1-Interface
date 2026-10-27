using Abp.Domain.Repositories;
using Abp.Domain.Services;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Capstone.Alerts;

/// <summary>
/// Writes in-app notifications. Since DEC-49 only time-triggered events (permit expiry, operational alerts) notify;
/// entry checks (water quality, mortality, stock) warn inline and appear in dashboard summaries and reports.
/// Repeated alerts for the same record and type within a day are merged.
/// </summary>
public class FarmAlertPublisher : DomainService
{
    private readonly IRepository<FarmNotification, Guid> _notifications;

    public FarmAlertPublisher(IRepository<FarmNotification, Guid> notifications)
    {
        _notifications = notifications;
    }

    public async Task PublishAsync(FarmNotificationType type, string recordType, Guid? recordId, string message, bool ownersOnly = false, bool oncePerRecord = false)
    {
        var since = DateTime.UtcNow.AddHours(-20);
        var existing = _notifications.GetAll().Where(n => n.Type == type && n.RelatedRecordId == recordId);
        if (!oncePerRecord)
        {
            existing = existing.Where(n => n.CreatedAtUtc >= since);
        }

        if (recordId.HasValue && await existing.AnyAsync())
        {
            return;
        }

        await _notifications.InsertAsync(new FarmNotification
        {
            Id = Guid.NewGuid(),
            Type = type,
            RelatedRecordType = recordType,
            RelatedRecordId = recordId,
            Message = message.Length > FarmNotification.MaxMessageLength ? message[..FarmNotification.MaxMessageLength] : message,
            CreatedAtUtc = DateTime.UtcNow,
            OwnersOnly = ownersOnly,
        });
    }
}
