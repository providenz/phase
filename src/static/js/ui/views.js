var Phase = Phase || {};

(function (exports, Phase, Backbone, _) {
    "use strict";

    var dispatcher = Phase.Events.dispatcher;

    Phase.Views = Phase.Views || {};

    Phase.Views.ToggleContentButton = Backbone.View.extend({
        events: {
            'click': 'toggleContent'
        },
        initialize: function () {
            this.content = $(this.$el.data('target'));

            this.listenTo(dispatcher, 'onEscKeyPressed', this.hideContent);
            this.listenTo(dispatcher, 'onBackdropClicked', this.hideContent);
        },
        toggleContent: function () {
            this.content.toggle();
        },
        hideContent: function () {
            this.content.hide();
        }
    });

    Phase.Views.BackdropView = Backbone.View.extend({
        events: {
            'click': 'react'
        },
        initialize: function () {

        },
        react: function () {
            dispatcher.trigger('onBackdropClicked');
        }
         
    });

    /**
     * A simple progress bar view, updated through a Progress model.
     */
    Phase.Views.ProgressView = Backbone.View.extend({
        el: '#progress-modal',
        initialize: function () {
            this.listenTo(this.model, 'onPollStarted', this.show);
            this.listenTo(this.model, 'change', this.render);

            this.progressBar = this.$el.find('.progress-bar');
            this.successMsg = this.$el.find('.alert-success');
        },
        render: function () {
            var progress = this.model.get('progress');
            this.progressBar.attr('aria-valuenow', progress);
            this.progressBar.css('width', progress + '%');
            return this;
        },
        show: function () {
            this.$el.modal('show');
        }
    });

    Phase.Views.ActionMenuView = Backbone.View.extend({
        events: {
            'click a': 'actionClick'
        },
        eventToListen: 'onModalFormSubmitted',
        initialize: function (options) {

            _.bindAll(this, 'actionSuccess');

            this.actionForm = this.$el.closest('form');

            this.listenTo(dispatcher, this.eventToListen, this.actionModalProcess);
        },
        // Submit form upon click on a batch action
        actionClick: function (event) {
            event.preventDefault();
            var menuItem = $(event.target);
            var modalId = menuItem.data('modal');
            var actionHref = menuItem.attr('href');
            var isAjax = menuItem.data('ajax');
            var method = menuItem.data('method');
            var formData = [];
            if (this.actionForm.length > 0) {
                formData = this.actionForm.serializeArray();
            }

            /*
             * If there is no confirmation modal, immediately submit the form.
             * Otherwise, raise an event to trigger the modal diplay.
             */
            if (modalId === '') {
                this.actionSubmit(actionHref, formData, method, isAjax);

            } else if (modalId === 'audit-trail-modal') {
                dispatcher.trigger('onAuditModalDisplayRequired', {
                    menuItem: menuItem,
                    formAction: actionHref,
                    formData: formData,
                    modalId: modalId
                });
            }
            else {
                dispatcher.trigger('onModalDisplayRequired', {
                    menuItem: menuItem,
                    formAction: actionHref,
                    formData: formData,
                    modalId: modalId
                });
            }
        },
        actionModalProcess: function (data) {
            var menuItem = data.menuItem;
            this.actionSubmit(
                data.formAction,
                data.formData,
                menuItem.data('method'),
                menuItem.data('ajax'));
        },

        actionSubmit: function (actionHref, formData, method, isAjax) {
            if (isAjax) {
                $.ajax(actionHref, {
                    method: method,
                    data: formData,
                    success: this.actionSuccess
                });
            } else {
                if (method === 'GET') {
                    exports.location.href = actionHref;
                } else {
                    var form = $('<form />');
                    form.attr('method', 'POST');
                    form.attr('action', actionHref);
                    var inputs = _.map(formData, function (data) {
                        var input = $('<input type="hidden" />');
                        input.attr('name', data.name);
                        input.attr('value', data.value);
                        return input;
                    });
                    form.append(inputs);
                    $('body').append(form);
                    form.submit();
                }
            }
        },
        actionSuccess: function (data) {
            if (data.hasOwnProperty('poll_url')) {
                var poll_url = data.poll_url;
                dispatcher.trigger('onPollableTaskStarted', {pollUrl: poll_url});
            }
        }

    });

    /**
     * Custom views to handle confirmation modals.
     */
    Phase.Views.ModalView = Backbone.View.extend({
        el: '#base-modal',
        events: {
            // events are bound in show/hide method to prevent firing when it is not wanted
        },
        triggerStr: 'onModalFormSubmitted',
        eventToListen: 'onModalDisplayRequired',
        initialize: function () {
            this.listenTo(dispatcher, this.eventToListen, this.display);
        },
        show: function () {
            this.delegateEvents((_.extend(this.events, {'submit form': 'submit'})));
            this.$el.modal('show');
        },
        hide: function () {
            this.$el.modal('hide');
            this.undelegateEvents();
        },
        display: function (data) {

            this.menuItem = data.menuItem;
            this.formAction = data.formAction;
            this.formData = data.formData;
            var modalId = data.modalId;
            var modalContent = $('#' + modalId).html();
            this.$el.html(modalContent);
            this.form = this.$el.find('form');
            this.show();
            $('.js-recipients-selectize').selectize({
                mode: 'multi',
                maxItems: 100,
                searchField: ['text']
            });
        },

        isValid: function (form) {
            var required = form.find(":input.js-required");
            var valid = true;
            required.each(function (i, el) {
                if (el.value.length < 1) {
                    alert('At least one value must be set on ' + el.name + ' field');
                    valid = false;
                }
            });

            return valid;
        },
        submit: function (event) {
            event.preventDefault();
            event.stopPropagation();
            var form = $(event.currentTarget);

            if (!this.isValid(form)) {
                return false;
            }

            var customFormData = form.serializeArray();
            var finalFormData = this.formData.concat(customFormData);
            this.hide();
            var data = {
                formAction: this.formAction,
                formData: finalFormData,
                menuItem: this.menuItem
            };
            dispatcher.trigger(this.triggerStr, data);
        }
    });

    Phase.Views.AuditModalView = Backbone.View.extend({
        el: '#base-modal',
        initialize: function () {
            this.listenTo(dispatcher, 'onAuditModalDisplayRequired', this.display);
            this.pageLimit = 10;
        },
        events: {
            'click .get_next_activities': 'getNext'
        },
        tpl: _.template($('#tpl-audit-trail').html()),
        show: function () {
            this.$el.modal('show');
        },
        hide: function () {
            this.$el.modal('hide');
        },
        display: function (data) {
            this.menuItem = data.menuItem;
            this.formAction = data.formAction;
            this.formData = data.formData;
            var modalId = data.modalId;
            var modalContent = $('#' + modalId);

            this.activities = new Phase.Models.Activities({url: this.formAction});
            this.activities.bind('add', this.refresh, this);
            var self = this;

            this.activities.fetch({data: {page_limit: this.pageLimit}}).done(function () {
                self.refresh();
            });
            this.$el.html(modalContent.html());
            this.show();
        },
        getNext: function () {
            this.activities.getNext(this.pageLimit);
        },
        refresh: function () {
            this.$el.find('.modal-body').html(this.tpl({
                value: this.activities.toJSON(),
                nextUrl: this.activities.url
            }));
        }
    });

    /**
     * Custom views to handle export.
     */
    Phase.Views.ExportMenuView = Phase.Views.ActionMenuView.extend({

        eventToListen: 'onExportModalFormSubmitted',

        // Submit form upon click
        actionClick: function (event) {
            event.preventDefault();
            var menuItem = $(event.target);
            var modalId = menuItem.data('modal');
            var method = menuItem.data('method');

            if (modalId === 'documents-export-modal') {
                var filtersParams = $('#export-button').data('filtersParams');

                var params = _.map(filtersParams, function (num, key) {
                    return {name: key, value: num};
                });

                dispatcher.trigger('onExportModalDisplayRequired', {
                    menuItem: menuItem,
                    formAction: menuItem.data('form-action'),
                    formData: params,
                    modalId: modalId
                });
            }
        },
        actionSuccess: function (data) {
            location.reload();
        }

    });

    Phase.Views.ExportModalView = Phase.Views.ModalView.extend({
        el: '#base-modal',
        events: {
            'submit #export-form': 'submit'
        },
        triggerStr: 'onExportModalFormSubmitted',
        eventToListen: 'onExportModalDisplayRequired',

        show: function () {
            this.$el.modal('show');
        },
        hide: function () {
            this.$el.modal('hide');
        }

    });

})(this, Phase, Backbone, _);
