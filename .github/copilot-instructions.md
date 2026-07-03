Changeset files under the '.changeset/' are automatically generated, so it's fine to ignore trailing spaces in them.

Entities' 'from' methods usually do more than constructors, like type conversion or data mapping, so always prefer to use 'from' over 'new' if they have it, except in the 'from' method or methods invoked by the 'from' method.
