# Brücke zwischen easy-Calender und dem lokal installierten Outlook (classic).
# Liest einen Auftrag als JSON von der Standardeingabe und schreibt das
# Ergebnis als JSON auf die Standardausgabe. Nichts verlässt den Rechner:
# Outlook selbst gleicht die Änderungen mit seinem Server ab.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

$OL_APPOINTMENT = 26
$OL_FOLDER_CALENDAR = 9
$MAX_ITEMS = 3000

function Utc([datetime]$value) {
  return $value.ToString('yyyy-MM-ddTHH:mm:ssZ')
}

function Describe($item, $occurrenceId) {
  $pattern = $null
  if ($item.IsRecurring -and -not $occurrenceId) {
    $p = $item.GetRecurrencePattern()
    $pattern = @{
      type        = [int]$p.RecurrenceType
      interval    = [int]$p.Interval
      dayMask     = [int]$p.DayOfWeekMask
      dayOfMonth  = [int]$p.DayOfMonth
      month       = [int]$p.MonthOfYear
      instance    = [int]$p.Instance
      noEnd       = [bool]$p.NoEndDate
      occurrences = [int]$p.Occurrences
      endDate     = $p.PatternEndDate.ToString('yyyy-MM-dd')
      startDate   = $p.PatternStartDate.ToString('yyyy-MM-dd')
    }
  }
  $id = $item.EntryID
  if ($occurrenceId) { $id = $occurrenceId }
  return @{
    id         = $id
    subject    = [string]$item.Subject
    body       = [string]$item.Body
    location   = [string]$item.Location
    allDay     = [bool]$item.AllDayEvent
    startUtc   = Utc $item.StartUTC
    endUtc     = Utc $item.EndUTC
    startDate  = $item.Start.ToString('yyyy-MM-dd')
    endDate    = $item.End.ToString('yyyy-MM-dd')
    busy       = [int]$item.BusyStatus
    meeting    = [int]$item.MeetingStatus
    occurrence = [bool]$occurrenceId
    pattern    = $pattern
    modified   = Utc $item.LastModificationTime.ToUniversalTime()
  }
}

# Eine ID ist die EntryID des Termins. Ein einzelnes Vorkommen einer Serie
# trägt zusätzlich seinen Beginn: «EntryID@2026-11-17T08:00:00Z».
function Resolve($ns, $storeId, $id) {
  $parts = $id.Split('@')
  try {
    $item = $ns.GetItemFromID($parts[0], $storeId)
  } catch {
    return $null
  }
  if ($null -eq $item -or $item.Class -ne $OL_APPOINTMENT) { return $null }
  if ($parts.Length -lt 2) { return $item }
  $start = [datetime]::Parse($parts[1], $null, [System.Globalization.DateTimeStyles]::RoundtripKind).ToLocalTime()
  try {
    return $item.GetRecurrencePattern().GetOccurrence($start)
  } catch {
    return $null
  }
}

function Apply($item, $event) {
  $item.Subject = [string]$event.subject
  $item.Body = [string]$event.body
  $item.Location = [string]$event.location
  if ($event.allDay) {
    $item.AllDayEvent = $true
    $item.Start = [datetime]::ParseExact($event.startDate, 'yyyy-MM-dd', $null)
    $item.End = [datetime]::ParseExact($event.endDate, 'yyyy-MM-dd', $null)
  } else {
    $item.AllDayEvent = $false
    $style = [System.Globalization.DateTimeStyles]::RoundtripKind
    $item.Start = [datetime]::Parse($event.startUtc, $null, $style).ToLocalTime()
    $item.End = [datetime]::Parse($event.endUtc, $null, $style).ToLocalTime()
  }
  # recurrence: 'keep' lässt die Serie in Ruhe, 'none' entfernt sie, sonst wird sie gesetzt.
  if ($event.recurrence -eq 'none') {
    if ($item.IsRecurring) { $item.ClearRecurrencePattern() }
  } elseif ($event.recurrence -eq 'set') {
    $p = $item.GetRecurrencePattern()
    $p.RecurrenceType = [int]$event.pattern.type
    if ($event.pattern.dayMask -gt 0) { $p.DayOfWeekMask = [int]$event.pattern.dayMask }
    if ($event.pattern.dayOfMonth -gt 0) { $p.DayOfMonth = [int]$event.pattern.dayOfMonth }
    if ($event.pattern.month -gt 0) { $p.MonthOfYear = [int]$event.pattern.month }
    if ($event.pattern.instance -gt 0) { $p.Instance = [int]$event.pattern.instance }
    $p.Interval = [int]$event.pattern.interval
    if ($event.pattern.occurrences -gt 0) {
      $p.Occurrences = [int]$event.pattern.occurrences
    } elseif ($event.pattern.endDate) {
      $p.PatternEndDate = [datetime]::ParseExact($event.pattern.endDate, 'yyyy-MM-dd', $null)
    } else {
      $p.NoEndDate = $true
    }
  }
  $item.Save()
}

try {
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $outlook = New-Object -ComObject Outlook.Application
  $ns = $outlook.GetNamespace('MAPI')
  $data = $null

  switch ($request.op) {
    'calendars' {
      $stores = @()
      foreach ($store in $ns.Stores) {
        try { $root = $store.GetDefaultFolder($OL_FOLDER_CALENDAR) } catch { continue }
        $calendars = @(@{ id = $root.EntryID; name = [string]$root.Name })
        foreach ($sub in $root.Folders) {
          if ($sub.DefaultItemType -eq 1) {
            $calendars += @{ id = $sub.EntryID; name = [string]$sub.Name }
          }
        }
        $stores += @{ storeId = $store.StoreID; name = [string]$store.DisplayName; calendars = $calendars }
      }
      $data = @{ stores = $stores }
    }

    'createCalendar' {
      $root = $ns.GetStoreFromID($request.storeId).GetDefaultFolder($OL_FOLDER_CALENDAR)
      foreach ($sub in $root.Folders) {
        if ($sub.Name -eq [string]$request.name) { throw 'Einen Kalender mit diesem Namen gibt es schon.' }
      }
      $created = $root.Folders.Add([string]$request.name, $OL_FOLDER_CALENDAR)
      $data = @{ id = $created.EntryID; name = [string]$created.Name }
    }

    'list' {
      $folder = $ns.GetFolderFromID($request.folderId, $request.storeId)
      $style = [System.Globalization.DateTimeStyles]::RoundtripKind
      $from = [datetime]::Parse($request.start, $null, $style).ToLocalTime()
      $to = [datetime]::Parse($request.end, $null, $style).ToLocalTime()
      $filter = "[Start] < '$($to.ToString('g'))' AND [End] > '$($from.ToString('g'))'"
      $events = @()
      $seen = @{}

      $items = $folder.Items
      if ($request.expand) {
        # Serien in einzelne Vorkommen auflösen. Das verlangt die Sortierung nach Beginn.
        $items.Sort('[Start]')
        $items.IncludeRecurrences = $true
      }
      $count = 0
      foreach ($item in $items.Restrict($filter)) {
        $count++
        if ($count -gt $MAX_ITEMS) { break }
        if ($item.Class -ne $OL_APPOINTMENT) { continue }
        if ($request.expand -and $item.IsRecurring) {
          $events += Describe $item "$($item.EntryID)@$(Utc $item.StartUTC)"
        } else {
          $seen[$item.EntryID] = $true
          $events += Describe $item $null
        }
      }

      if (-not $request.expand) {
        # Serien, die vor dem Zeitraum begonnen haben und noch laufen.
        foreach ($item in $folder.Items.Restrict('[IsRecurring] = True')) {
          if ($item.Class -ne $OL_APPOINTMENT -or $seen[$item.EntryID]) { continue }
          $p = $item.GetRecurrencePattern()
          if ($p.NoEndDate -or $p.PatternEndDate -ge $from.Date) { $events += Describe $item $null }
        }
      }
      $data = @{ events = $events }
    }

    'get' {
      $item = Resolve $ns $request.storeId $request.id
      if ($item) { $data = @{ event = Describe $item $(if ($request.id.Contains('@')) { $request.id } else { $null }) } }
      else { $data = @{ event = $null } }
    }

    'create' {
      $folder = $ns.GetFolderFromID($request.folderId, $request.storeId)
      $item = $folder.Items.Add(1)
      Apply $item $request.event
      $data = @{ event = Describe $item $null }
    }

    'update' {
      $item = Resolve $ns $request.storeId $request.id
      if (-not $item) { throw 'Der Termin wurde in Outlook nicht gefunden.' }
      Apply $item $request.event
      $data = @{ event = Describe $item $(if ($request.id.Contains('@')) { $request.id } else { $null }) }
    }

    'delete' {
      $item = Resolve $ns $request.storeId $request.id
      if ($item) { $item.Delete() }
      $data = @{ deleted = [bool]$item }
    }

    default { throw "Unbekannter Auftrag: $($request.op)" }
  }

  @{ ok = $true; data = $data } | ConvertTo-Json -Depth 8 -Compress
} catch {
  @{ ok = $false; error = [string]$_.Exception.Message } | ConvertTo-Json -Compress
}
