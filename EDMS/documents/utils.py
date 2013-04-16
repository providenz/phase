from django.db.models import Q

from documents.models import Document


def filter_documents(queryset, data):
    """Filter documents from a queryset given data from DataTables.

    Documentation (lack of is more accurate though):
    http://www.datatables.net/examples/server_side/server_side.html
    """
    # Dummy document to retrieve displayed fields
    # TODO: find a better way to achieve this
    document = Document(title=u'', revision_date='', leader=u'', approver=u'')
    display_fields = document.display_fields()
    searchable_fields = document.searchable_fields()

    # Paging (done at the view level, the whole queryset is still required)

    # Ordering
    if 'iSortCol_0' in data:
        sort_column = data['iSortCol_0']
        sort_direction = data['sSortDir_0'] == u'desc' and u'-' or u''
        if sort_column == 0:  # fallback on document_number
            column_name = (sort_direction+'document_number',)
        else:
            column_name = (sort_direction+display_fields[sort_column][1],)
        queryset = queryset.order_by(*column_name)

    # Filtering (global)
    if 'sSearch' in data:
        search_terms = data['sSearch']
        if search_terms:
            q = Q()
            for field in searchable_fields:
                q.add(Q(**{'%s__icontains' % field: search_terms}), Q.OR)
            queryset = queryset.filter(q)

    # Filtering (per field)
    for i, field in enumerate(display_fields):
        if data.get('sSearch_'+str(i-1), False):
            queryset = queryset.filter(**{
                '%s__exact' % field[1]: data['sSearch_'+str(i-1)]
            })

    return queryset