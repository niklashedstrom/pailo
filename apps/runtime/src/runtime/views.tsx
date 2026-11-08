import type { Collection, Field, View } from '@pailo/schema'
import { useState } from 'react'
import type { AppRecord } from '../api'
import {
  type DayKey,
  addDays,
  addMonths,
  dayOf,
  formatMonth,
  formatWeekday,
  isoWeek,
  monthDays,
  startOfMonth,
  startOfWeek,
  timeOf,
  today,
  weekDays,
} from './dates'
import { FieldValue } from './FieldValue'
import { type AppData, displayText, findCollection, recordTitle, recordsIn, sortRecords } from './values'

export interface ViewProps {
  data: AppData
  onOpen: (record: AppRecord) => void
  /** Injected in tests so the calendar has a fixed "today". */
  now?: Date
}

/** The fields a view shows: the listed ones in order, or all but images. */
function shownFields(collection: Collection, ids: string[] | undefined): Field[] {
  if (!ids) return collection.fields.filter((field) => field.type !== 'image')
  return ids.flatMap((id) => collection.fields.filter((field) => field.id === id))
}

function RecordSummary({
  record,
  collection,
  fields,
  data,
  onOpen,
  className,
}: {
  record: AppRecord
  collection: Collection
  fields: Field[]
  data: AppData
  onOpen: (record: AppRecord) => void
  className: string
}) {
  // The first shown text field is the heading; without one, the record's title.
  const heading = fields.find((field) => field.type === 'text')
  const rest = fields.filter((field) => field !== heading)
  return (
    <li className={className}>
      <button type="button" className="record" onClick={() => onOpen(record)}>
        <strong className="record-title">
          {(heading && displayText(heading, record.data[heading.id], data)) || recordTitle(collection, record)}
        </strong>
        {rest.map((field) => (
          <span key={field.id} className="record-field">
            <span className="visually-hidden">{field.label}: </span>
            <FieldValue field={field} value={record.data[field.id]} data={data} />
          </span>
        ))}
      </button>
    </li>
  )
}

function Empty({ collection }: { collection: Collection }) {
  return <p className="empty">Inget i {collection.name.toLocaleLowerCase('sv')} än.</p>
}

function ListOrCards({ view, props, layout }: { view: Extract<View, { type: 'list' | 'cards' }>; props: ViewProps; layout: 'list' | 'cards' }) {
  const collection = findCollection(props.data.description, view.collection)
  if (!collection) return null
  const records = sortRecords(recordsIn(props.data, collection.id), collection, view.sort, props.data)
  if (records.length === 0) return <Empty collection={collection} />
  const fields = shownFields(collection, view.fields)
  return (
    <ul className={layout === 'list' ? 'records-list' : 'records-cards'}>
      {records.map((record) => (
        <RecordSummary
          key={record.id}
          record={record}
          collection={collection}
          fields={fields}
          data={props.data}
          onOpen={props.onOpen}
          className={layout === 'list' ? 'list-item' : 'card'}
        />
      ))}
    </ul>
  )
}

function CalendarView({ view, props }: { view: Extract<View, { type: 'calendar' }>; props: ViewProps }) {
  const current = today(props.now)
  const [anchor, setAnchor] = useState<DayKey>(current)
  const collection = findCollection(props.data.description, view.collection)
  const dateField = collection?.fields.find((field) => field.id === view.dateField)
  if (!collection || !dateField) return null

  const week = view.range === 'week'
  const days = week ? weekDays(anchor) : monthDays(anchor)
  const step = (direction: 1 | -1) =>
    setAnchor((day) => (week ? addDays(startOfWeek(day), 7 * direction) : addMonths(startOfMonth(day), direction)))
  const title = week ? `Vecka ${isoWeek(anchor)}` : formatMonth(anchor)
  const fields = shownFields(collection, view.fields).filter((field) => field.id !== view.dateField)

  const byDay = new Map<DayKey, AppRecord[]>()
  for (const record of recordsIn(props.data, collection.id)) {
    const day = dayOf(record.data[dateField.id])
    if (day === null || !days.includes(day)) continue
    byDay.set(day, [...(byDay.get(day) ?? []), record])
  }
  const shownDays = week ? days : days.filter((day) => byDay.has(day))

  return (
    <section className="calendar" aria-label={title}>
      <div className="calendar-nav">
        <button type="button" className="secondary" onClick={() => step(-1)}>
          {week ? 'Förra veckan' : 'Förra månaden'}
        </button>
        <h2>{title}</h2>
        <button type="button" className="secondary" onClick={() => step(1)}>
          {week ? 'Nästa vecka' : 'Nästa månad'}
        </button>
      </div>
      {shownDays.length === 0 && <p className="empty">Inget den här månaden.</p>}
      <ol className="days">
        {shownDays.map((day) => {
          const records = (byDay.get(day) ?? []).toSorted((a, b) =>
            (timeOf(a.data[dateField.id]) ?? '').localeCompare(timeOf(b.data[dateField.id]) ?? ''),
          )
          return (
            <li key={day} className={day === current ? 'day today' : 'day'} aria-current={day === current ? 'date' : undefined}>
              <h3 className="day-name">{formatWeekday(day)}</h3>
              {records.length === 0 ? (
                <p className="empty">–</p>
              ) : (
                <ul className="records-list">
                  {records.map((record) => (
                    <RecordSummary
                      key={record.id}
                      record={record}
                      collection={collection}
                      fields={[...(timeOf(record.data[dateField.id]) ? [dateField] : []), ...fields]}
                      data={props.data}
                      onOpen={props.onOpen}
                      className="list-item"
                    />
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function OverviewView({ view, props }: { view: Extract<View, { type: 'overview' }>; props: ViewProps }) {
  return (
    <div className="overview">
      {view.sections.map((section, index) => {
        const collection = findCollection(props.data.description, section.collection)
        if (!collection) return null
        const records = sortRecords(recordsIn(props.data, collection.id), collection, section.sort, props.data).slice(
          0,
          section.limit ?? 10,
        )
        const fields = shownFields(collection, undefined).slice(0, 3)
        return (
          <section key={`${section.collection}-${index}`} className="overview-section">
            <h2>{section.title ?? collection.name}</h2>
            {records.length === 0 ? (
              <Empty collection={collection} />
            ) : (
              <ul className="records-list">
                {records.map((record) => (
                  <RecordSummary
                    key={record.id}
                    record={record}
                    collection={collection}
                    fields={fields}
                    data={props.data}
                    onOpen={props.onOpen}
                    className="list-item"
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

/** Renders any view of any app; one case per view type in the schema. */
export function ViewContent({ view, ...props }: ViewProps & { view: View }) {
  switch (view.type) {
    case 'list':
      return <ListOrCards view={view} props={props} layout="list" />
    case 'cards':
      return <ListOrCards view={view} props={props} layout="cards" />
    case 'calendar':
      return <CalendarView key={view.id} view={view} props={props} />
    case 'overview':
      return <OverviewView view={view} props={props} />
    default: {
      const unknownView: never = view
      return unknownView
    }
  }
}
