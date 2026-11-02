import { Component, ChangeDetectionStrategy, OnDestroy, OnInit, signal } from '@angular/core';
import { FarmTime } from '@shared/fpms/farm-time';

/** Today's date and the time in the farm's time zone, in the farm's date and time style. Updates every 15 seconds. */
@Component({
    selector: 'header-clock',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <li class="nav-item d-none d-md-block fpms-clock" aria-label="Date and time at the farm">
            <div class="fpms-clock-date">{{ date() }}</div>
            <div class="fpms-clock-time">{{ time() }} · farm time</div>
        </li>
    `,
})
export class HeaderClockComponent implements OnInit, OnDestroy {
    date = signal(FarmTime.longDateNow());
    time = signal(FarmTime.timeNow());
    private timer: ReturnType<typeof setInterval>;

    ngOnInit(): void {
        this.timer = setInterval(() => {
            this.date.set(FarmTime.longDateNow());
            this.time.set(FarmTime.timeNow());
        }, 15000);
    }

    ngOnDestroy(): void {
        clearInterval(this.timer);
    }
}
