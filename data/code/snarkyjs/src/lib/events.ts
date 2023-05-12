import { prefixes } from '../bindings/crypto/constants.js';
import { prefixToField } from '../bindings/lib/binable.js';
import {
  GenericField,
  GenericProvableExtended,
} from '../bindings/lib/generic.js';

export { createEvents, dataAsHash };

type Poseidon<Field> = {
  update(state: Field[], input: Field[]): Field[];
};

function createEvents<Field>({
  Field,
  Poseidon,
}: {
  Field: GenericField<Field>;
  Poseidon: Poseidon<Field>;
}) {
  type Event = Field[];

  type Events = {
    hash: Field;
    data: Event[];
  };

  // hashing helpers
  function initialState() {
    return [Field(0), Field(0), Field(0)] as [Field, Field, Field];
  }
  function salt(prefix: string) {
    return Poseidon.update(initialState(), [prefixToField(Field, prefix)]);
  }
  function hashWithPrefix(prefix: string, input: Field[]) {
    let init = salt(prefix);
    return Poseidon.update(init, input)[0];
  }
  function emptyHashWithPrefix(prefix: string) {
    return salt(prefix)[0];
  }

  const Events = {
    empty(): Events {
      let hash = emptyHashWithPrefix('MinaZkappEventsEmpty');
      return { hash, data: [] };
    },
    pushEvent(events: Events, event: Event): Events {
      let eventHash = hashWithPrefix(prefixes.event, event);
      let hash = hashWithPrefix(prefixes.events, [events.hash, eventHash]);
      return { hash, data: [event, ...events.data] };
    },
    fromList(events: Event[]): Events {
      return [...events].reverse().reduce(Events.pushEvent, Events.empty());
    },
    hash(events: Event[]) {
      return Events.fromList(events).hash;
    },
  };
  const EventsProvable = {
    ...Events,
    ...dataAsHash({
      emptyValue: Events.empty,
      toJSON(data: Field[][]) {
        return data.map((row) => row.map((e) => Field.toJSON(e)));
      },
      fromJSON(json: string[][]) {
        let data = json.map((row) => row.map((e) => Field.fromJSON(e)));
        let hash = Events.hash(data);
        return { data, hash };
      },
    }),
  };

  const Actions = {
    // same as events but w/ different hash prefixes
    empty(): Events {
      let hash = emptyHashWithPrefix('MinaZkappActionsEmpty');
      return { hash, data: [] };
    },
    pushEvent(actions: Events, event: Event): Events {
      let eventHash = hashWithPrefix(prefixes.event, event);
      let hash = hashWithPrefix(prefixes.sequenceEvents, [
        actions.hash,
        eventHash,
      ]);
      return { hash, data: [event, ...actions.data] };
    },
    fromList(events: Event[]): Events {
      return [...events].reverse().reduce(Actions.pushEvent, Actions.empty());
    },
    hash(events: Event[]) {
      return this.fromList(events).hash;
    },
    // different than events
    emptyActionState() {
      return emptyHashWithPrefix('MinaZkappActionStateEmptyElt');
    },
    updateSequenceState(state: Field, sequenceEventsHash: Field) {
      return hashWithPrefix(prefixes.sequenceEvents, [
        state,
        sequenceEventsHash,
      ]);
    },
  };

  const SequenceEventsProvable = {
    ...Actions,
    ...dataAsHash({
      emptyValue: Actions.empty,
      toJSON(data: Field[][]) {
        return data.map((row) => row.map((e) => Field.toJSON(e)));
      },
      fromJSON(json: string[][]) {
        let data = json.map((row) => row.map((e) => Field.fromJSON(e)));
        let hash = Actions.hash(data);
        return { data, hash };
      },
    }),
  };

  return { Events: EventsProvable, Actions: SequenceEventsProvable };
}

function dataAsHash<T, J, Field>({
  emptyValue,
  toJSON,
  fromJSON,
}: {
  emptyValue: () => { data: T; hash: Field };
  toJSON: (value: T) => J;
  fromJSON: (json: J) => { data: T; hash: Field };
}): GenericProvableExtended<{ data: T; hash: Field }, J, Field> & {
  emptyValue(): { data: T; hash: Field };
} {
  return {
    emptyValue,
    sizeInFields() {
      return 1;
    },
    toFields({ hash }) {
      return [hash];
    },
    toAuxiliary(value) {
      return [value?.data ?? emptyValue().data];
    },
    fromFields([hash], [data]) {
      return { data, hash };
    },
    toJSON({ data }) {
      return toJSON(data);
    },
    fromJSON(json) {
      return fromJSON(json);
    },
    check() {},
    toInput({ hash }) {
      return { fields: [hash] };
    },
  };
}
