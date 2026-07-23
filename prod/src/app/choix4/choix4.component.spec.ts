import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Choix4Component } from './choix4.component';

describe('Choix4Component', () => {
  let component: Choix4Component;
  let fixture: ComponentFixture<Choix4Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Choix4Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Choix4Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
