namespace Capstone.Production;

/// <summary>Values 1 (Planned) and 3 (Failed) were retired in step C; never reuse them.</summary>
public enum CycleStatus { Active = 2, Closed = 4 }

/// <summary>Value 1 (Planned) was retired in step C; never reuse it.</summary>
public enum BatchStatus { Stocked = 2, Harvested = 3, Failed = 4, Closed = 5 }

public enum TransportMode { Truck = 1, Van = 2, Motorcycle = 3, Boat = 4, Other = 5 }

/// <summary>
/// Log types. Feeding (3) moved to FeedingSession, pond preparation (1) to the pond, and post-production (8) was
/// removed in step D; those values remain only on historical rows and are never reused.
/// </summary>
public enum LogType
{
    PondPreparation = 1,
    PreStockingWaterQuality = 2,
    Feeding = 3,
    WaterQuality = 4,
    GrowthSampling = 5,
    ChemicalApplication = 6,
    Mortality = 7,
    PostProduction = 8,
    GeneralNote = 9,

    /// <summary>Work done on the pond during culture: water exchange, aeration, cleaning (DEC-91).</summary>
    PondActivity = 10,
}

/// <summary>A feeding session is Fed (with usage movements) or Not fed (no movements) (DEC-50).</summary>
public enum FeedingStatus { Fed = 1, NotFed = 2 }

/// <summary>Stocking density judged against the pond's band at stocking (DEC-52).</summary>
public enum DensityFlag { Within = 1, Below = 2, Above = 3 }

/// <summary>Which side of the optimal range a reading falls on.</summary>
public enum ReadingSide { Low = 1, High = 2 }

public enum PondPreparationActivity { Draining = 1, Drying = 2, Liming = 3, Disinfection = 4, Filling = 5, Other = 6 }

public enum FeedingMethod { Broadcast = 1, Tray = 2, AutoFeeder = 3, Other = 4 }

public enum MortalityCause { Disease = 1, WaterQuality = 4, Others = 7 }


/// <summary>
/// Activities kept in the activity detail table. 1 to 3 are historical post-production steps; 5 to 7, with Other, are the
/// pond activities recorded during culture (DEC-91), which share the table so no new one is needed.
/// </summary>
public enum PostProductionActivity { SludgeRemoval = 1, Drying = 2, EquipmentMaintenance = 3, Other = 4, WaterExchange = 5, Aeration = 6, PondCleaning = 7 }

/// <summary>Outcome confirmed at Close Production Cycle (DEC-64). A field, not a status.</summary>
public enum CycleOutcome { Completed = 1, Failed = 2 }

/// <summary>What an Owner reopened (DEC-64).</summary>
public enum ReopenedEntityType { Batch = 1, Cycle = 2 }
